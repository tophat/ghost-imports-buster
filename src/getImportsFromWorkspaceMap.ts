import { promises as fs } from 'fs'
import path from 'path'
import Module from 'module'

import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { Workspace, structUtils } from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'

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
            workspace,
        )
        importsMap.set(workspace, collectedImports)
    }
    return importsMap
}

async function collectImportsFromWorkspace(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
): Promise<Set<ImportRecord>> {
    if (!workspace.manifest.name) throw new Error('MISSING_IDENT')
    const workspaceName = structUtils.stringifyIdent(workspace.manifest.name)
    const workspaceRoot = workspace.cwd
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

    for await (const importedFrom of collectPaths(
        configuration,
        workspace,
        workspaceRoot,
    )) {
        const content = await fs.readFile(importedFrom, { encoding: 'utf8' })
        const ast = parse(content, {
            plugins: ['typescript'],
            sourceType: 'module',
        })

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
    filename: string,
): AsyncIterable<string> {
    const basename = path.basename(filename)
    const stat = await fs.stat(filename)

    if (basename.startsWith('.')) return

    if (
        !stat.isDirectory() &&
        (!configuration.includeFiles(filename) ||
            configuration.excludeFiles(filename))
    ) {
        return
    }

    // if dir belongs to another workspace, don't return any files
    const discoveredWorkspace = workspace.project.tryWorkspaceByFilePath(
        npath.toPortablePath(filename),
    )
    if (
        !discoveredWorkspace ||
        !structUtils.areDescriptorsEqual(
            discoveredWorkspace.anchoredDescriptor,
            workspace.anchoredDescriptor,
        )
    ) {
        return
    }

    if (stat.isDirectory()) {
        for (const childFilename of await fs.readdir(filename)) {
            yield* collectPaths(
                configuration,
                workspace,
                path.join(filename, childFilename),
            )
        }
    } else if (basename.match(/\.(j|t)sx?$/)) {
        yield filename
    }
}
