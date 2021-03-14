import { promises as fs } from 'fs'
import { join } from 'path'
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
    const workspaces = context.project.workspaces
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
    const workspacePaths = await collectPaths(
        configuration,
        workspace,
        workspaceRoot,
    )

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

    for (const importedFrom of workspacePaths) {
        const content = await fs.readFile(importedFrom, { encoding: 'utf8' })
        const ast = parse(content, {
            plugins: ['typescript'],
            sourceType: 'module',
        })

        traverse(ast, {
            ImportDeclaration: function (path) {
                const imported = path.node.source.value
                visitPath({ importedFrom, imported })
            },
            CallExpression: function (path) {
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

async function collectPaths(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
    root: string,
): Promise<Set<string>> {
    const rootStat = await fs.stat(root)
    const isIncluded = configuration.includeFiles(root)
    const isExcluded = configuration.excludeFiles(root)

    if (!rootStat.isDirectory()) {
        return root.match(/\.(j|t)sx?$/) && isIncluded && !isExcluded
            ? new Set([root])
            : new Set()
    }

    // if dir belongs to another workspace, don't return any files
    const discoveredWorkspace = workspace.project.tryWorkspaceByFilePath(
        npath.toPortablePath(root),
    )
    if (
        !discoveredWorkspace ||
        !structUtils.areDescriptorsEqual(
            discoveredWorkspace.anchoredDescriptor,
            workspace.anchoredDescriptor,
        )
    ) {
        return new Set()
    }

    const directoryListing = await fs.readdir(root)
    const collectedPaths = []
    for (const current of directoryListing) {
        collectedPaths.push(
            ...(await collectPaths(
                configuration,
                workspace,
                join(root, current),
            )),
        )
    }

    return new Set(collectedPaths)
}
