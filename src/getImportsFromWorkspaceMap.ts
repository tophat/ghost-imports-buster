import { promises as fs, readdirSync, statSync } from 'fs'
import { join } from 'path'
import Module from 'module'

import minimatch from 'minimatch'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { Workspace } from '@yarnpkg/core'

import {
    AnalysisConfiguration,
    BabelParserNode,
    Context,
    PackagesByWorkspaceMap,
} from './types'

export default async function getImportsByWorkspaceMap(
    context: Context,
    configuration: AnalysisConfiguration,
): Promise<PackagesByWorkspaceMap> {
    const workspaces = context.project.workspaces
    const importsMap: PackagesByWorkspaceMap = new Map()

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
): Promise<Set<string>> {
    const workspaceRoot = workspace.cwd
    const workspacePaths = collectPaths(configuration, workspaceRoot)

    const imports: Set<string> = new Set()

    const isRelativeImport = (imported: string): boolean =>
        imported?.startsWith('.')

    for (const filePath of workspacePaths) {
        const content = await fs.readFile(filePath, { encoding: 'utf8' })
        const ast = parse(content, {
            plugins: ['typescript'],
            sourceType: 'module',
        })

        traverse(ast, {
            ImportDeclaration: function (path: BabelParserNode) {
                const imported = path.node.source.value
                if (
                    !isRelativeImport(imported) &&
                    !Module.builtinModules.includes(imported)
                )
                    imports.add(imported)
            },
            CallExpression: function (path: BabelParserNode) {
                const callee = path.node.callee.name
                const argumentType = path.node.arguments[0]?.type
                const imported = path.node.arguments[0]?.value
                if (
                    callee === 'require' &&
                    argumentType === 'StringLiteral' &&
                    !isRelativeImport(imported) &&
                    !Module.builtinModules.includes(imported)
                ) {
                    imports.add(imported)
                }
            },
        })
    }

    return imports
}

function collectPaths(
    configuration: AnalysisConfiguration,
    root: string,
): Set<string> {
    const rootStat = statSync(root)

    if (!rootStat.isDirectory()) {
        const isIncluded = [...configuration.include].some((includedGlob) =>
            minimatch(join(root), includedGlob),
        )
        return root.match(/\.(j|t)sx?$/) && isIncluded
            ? new Set([root])
            : new Set()
    }

    const directoryListing = readdirSync(root)

    const collectedPaths = directoryListing.reduce(
        (paths: string[], current: string): string[] => {
            return [
                ...paths,
                ...collectPaths(configuration, join(root, current)),
            ]
        },
        [],
    )

    return new Set(collectedPaths)
}
