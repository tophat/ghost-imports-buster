import { promises as fs, readdirSync, statSync } from 'fs'
import { join } from 'path'

import minimatch from 'minimatch'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { Workspace } from '@yarnpkg/core'

import {
    AnalysisConfiguration,
    BabelParserNode,
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
    const workspaceRoot = workspace.cwd
    const workspacePaths = collectPaths(configuration, workspaceRoot)

    const imports: Set<ImportRecord> = new Set()

    for (const filePath of workspacePaths) {
        const content = await fs.readFile(filePath, { encoding: 'utf8' })
        const ast = parse(content, {
            plugins: ['typescript'],
            sourceType: 'module',
        })

        traverse(ast, {
            ImportDeclaration: function (path: BabelParserNode) {
                const imported = path.node.source.value
                imports.add({ importedFrom: filePath, imported })
            },
            CallExpression: function (path: BabelParserNode) {
                const callee = path.node.callee.name
                const argumentType = path.node.arguments[0]?.type
                const calleeProperty = path.node.property?.name
                const calleeObject = path.node.object?.name

                const imported = path.node.arguments[0]?.value
                if (
                    ['require', 'import'].includes(callee) &&
                    argumentType === 'StringLiteral' // &&
                ) {
                    imports.add({ importedFrom: filePath, imported })
                } else if (
                    calleeProperty === 'resolve' &&
                    calleeObject === 'require' &&
                    argumentType === 'StringLiteral'
                )
                    imports.add({ importedFrom: filePath, imported })

                // TODO: Require ensure?
                // TODO: Add logging if require without StringLiteral
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
        const isIncluded = [
            ...configuration.include,
        ].some((includedGlob): boolean => minimatch(join(root), includedGlob))

        const isExcluded = [
            ...configuration.exclude,
        ].some((excludedGlob: string): boolean =>
            minimatch(join(root), excludedGlob),
        )

        return root.match(/\.(j|t)sx?$/) && isIncluded && !isExcluded
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
