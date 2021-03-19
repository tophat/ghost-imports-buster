import { promises as fs } from 'fs'
import path from 'path'
import Module from 'module'

import { transformAsync } from '@babel/core'
import traverse from '@babel/traverse'
import { Workspace, structUtils } from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'
import fastGlob from 'fast-glob'

import {
    AnalysisConfiguration,
    Context,
    ImportRecord,
    ImportRecordsByWorkspaceMap,
} from './types'

export default async function getImportsByWorkspaceMap(
    context: Context,
    configuration: AnalysisConfiguration,
): Promise<ImportRecordsByWorkspaceMap> {
    const workspaces = [...context.workspaceCwds].map((cwd) =>
        context.project.getWorkspaceByCwd(npath.toPortablePath(cwd)),
    )
    const importsMap: ImportRecordsByWorkspaceMap = new Map()

    for (const workspace of workspaces) {
        const collectedImports = await collectImportsFromWorkspace(
            configuration,
            context,
            workspace,
        )
        importsMap.set(workspace, collectedImports)
    }
    return importsMap
}

async function collectImportsFromWorkspace(
    configuration: AnalysisConfiguration,
    context: Context,
    workspace: Workspace,
): Promise<Set<ImportRecord>> {
    if (!workspace.manifest.name) throw new Error('MISSING_IDENT')
    const workspaceName = structUtils.stringifyIdent(workspace.manifest.name)
    const imports: Set<ImportRecord> = new Set()

    // match up until path specifier (a "/" not used for scope):
    //     @scope/name
    //     name
    const IMPORT_NAME_PATTERN = /^(?:(@[^/]+\/[^/]+)|([^.][^/]+))/

    const visitPath = ({
        importedFrom,
        imported,
    }: {
        importedFrom: string
        imported: string
    }): void => {
        try {
            if (
                Module.builtinModules.includes(
                    require.resolve(imported, { paths: [importedFrom] }),
                )
            ) {
                return
            }
        } catch {
            /* ignore */
        }

        const importedName = IMPORT_NAME_PATTERN.exec(imported)
        if (!importedName) return

        imports.add({
            importedFrom,
            imported: importedName[0],
        })
    }

    for await (const importedFrom of collectPaths(configuration, workspace)) {
        const content = await fs.readFile(importedFrom, { encoding: 'utf8' })

        const result = await transformAsync(content, {
            filename: importedFrom,
            root: context.project.cwd,
            ast: true,
            code: false,
        })

        if (!result?.ast) {
            throw new Error(`Failed to transform ${importedFrom}`)
        }
        const ast = result.ast

        const skipLines = new Set<number>()

        for (const comment of ast.comments ?? []) {
            if (comment.value.trim() === 'ghost-imports-ignore-next-line') {
                skipLines.add(comment.loc.end.line + 1)
            }
        }

        traverse(ast, {
            ImportDeclaration: function (path) {
                if (skipLines.has(path.node.loc?.start.line ?? -1)) return

                const imported = path.node.source.value
                visitPath({ importedFrom, imported })
            },
            CallExpression: function (path) {
                if (skipLines.has(path.node.loc?.start.line ?? -1)) return

                const predicates = [
                    // syntax:
                    //    require('pkg')
                    //    import('pkg')
                    (): boolean =>
                        path.node.callee.type === 'Identifier' &&
                        ['require', 'import'].includes(path.node.callee.name),
                    // syntax:
                    //     require.resolve('pkg')
                    (): boolean =>
                        path.node.callee.type === 'MemberExpression' &&
                        path.node.callee.property.type === 'Identifier' &&
                        path.node.callee.property.name === 'resolve' &&
                        path.node.callee.object.type === 'Identifier' &&
                        path.node.callee.object.name === 'require',
                ]

                if (predicates.some((p) => p())) {
                    const argument = path.node.arguments[0]
                    if (argument?.type === 'StringLiteral') {
                        visitPath({ importedFrom, imported: argument.value })
                    } else {
                        console.warn(
                            `[${workspaceName}] A non-literal expression has been found in a "require" call, unable to determine import\n` +
                                `    at %s:%s:%s\n`,
                            importedFrom,
                            path.node.loc?.start.line ?? 0,
                            path.node.loc?.start.column ?? 0,
                        )
                    }
                }
            },
        })
    }

    return imports
}

async function* collectPaths(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
): AsyncIterable<string> {
    const paths = await fastGlob(configuration.includeFiles, {
        absolute: true,
        ignore: configuration.excludeFiles,
        cwd: workspace.cwd,
    })

    for (const filepath of paths) {
        const basename = path.basename(filepath)
        // Exclude if dotfile.
        if (basename.startsWith('.')) continue
        // Exclude if not part of the current workspace.
        const discoveredWorkspace = workspace.project.tryWorkspaceByFilePath(
            npath.toPortablePath(filepath),
        )
        if (
            !discoveredWorkspace ||
            !structUtils.areDescriptorsEqual(
                discoveredWorkspace.anchoredDescriptor,
                workspace.anchoredDescriptor,
            )
        )
            continue
        // Include if ts/js source.
        if (basename.match(/\.(j|t)sx?$/)) yield filepath
    }
}
