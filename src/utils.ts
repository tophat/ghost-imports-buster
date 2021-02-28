import { join, resolve } from 'path'
import { promises as fs, readdirSync, statSync } from 'fs'
import Module from 'module'

import { Configuration, Project, Workspace, structUtils } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { PortablePath } from '@yarnpkg/fslib'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import chalk from 'chalk'
import minimatch from 'minimatch'

import {
    AnalysisConfiguration,
    Arguments,
    BabelParserNode,
    Context,
    DiffReport,
    PackagesByWorkspaceMap,
    Report,
} from './types'

export function getConfiguration(args: Arguments): AnalysisConfiguration {
    return {
        includes: new Set(args.includes ?? ['**/**']),
    }
}

export async function getContext(cwd?: string): Promise<Context> {
    const fullCwd = resolve(process.cwd(), cwd ?? '') as PortablePath
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, fullCwd)
    return { configuration, project, cwd: fullCwd }
}

export function diffDependenciesAndImportsByWorkspace(
    context: Context,
    dependenciesMap: PackagesByWorkspaceMap,
    importsMap: PackagesByWorkspaceMap,
): DiffReport {
    const { workspaces } = context.project
    const undeclaredDependenciesMap = new Map()
    const unusedDependenciesMap = new Map()
    for (const workspace of workspaces) {
        if (!workspace.manifest?.name) throw new Error('MISSING_IDENT')

        const workspaceIdent = structUtils.stringifyIdent(
            workspace.manifest.name,
        )
        const workspaceDependencies =
            dependenciesMap.get(workspace) ?? new Set()
        const workspaceImports = importsMap.get(workspace) ?? new Set()

        const undeclaredDependencies = getUndeclaredDependencies(
            workspaceDependencies,
            workspaceImports,
        )
        const unusedDependencies = getUnusedDependencies(
            workspaceDependencies,
            workspaceImports,
        )

        undeclaredDependenciesMap.set(workspaceIdent, undeclaredDependencies)
        unusedDependenciesMap.set(workspaceIdent, unusedDependencies)
    }

    return {
        undeclared: undeclaredDependenciesMap,
        unused: unusedDependenciesMap,
    }
}

export function printReport(report: Report): void {
    for (const workspaceIdent of report.workspaces) {
        const unused = report.unusedDependencies.get(workspaceIdent)
        const undeclared = report.undeclaredDependencies.get(workspaceIdent)

        console.log(`📦 ${workspaceIdent}`)

        if (unused && unused.size > 0) {
            console.log(
                chalk.yellow(
                    'Unused dependencies (declared but not imported anywhere)',
                ),
            )
            unused.forEach((dependency) => {
                console.log(`→ ${dependency}`)
            })
        } else {
            console.log(chalk.green('No unused dependencies!'))
        }
        if (undeclared && undeclared.size > 0) {
            console.log(
                chalk.red(
                    'Undeclared dependencies (imported but not declared in package.json)',
                ),
            )
            undeclared.forEach((dependency) => {
                console.log(`→ ${dependency}`)
            })
        } else {
            console.log(chalk.green('No undeclared dependencies!'))
        }
    }
}

export async function getDependenciesByWorkspaceMap(
    context: Context,
): Promise<PackagesByWorkspaceMap> {
    const dependenciesByWorkspace: PackagesByWorkspaceMap = new Map()

    for (const workspace of context.project.workspaces) {
        const dependencies = [...workspace.manifest.dependencies.values()].map(
            structUtils.stringifyIdent,
        )

        dependenciesByWorkspace.set(workspace, new Set(dependencies))
    }

    return dependenciesByWorkspace
}
export function collectPaths(
    configuration: AnalysisConfiguration,
    root: string,
): Set<string> {
    const rootStat = statSync(root)

    if (!rootStat.isDirectory()) {
        const isIncluded = [...configuration.includes].some((includedGlob) =>
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
export async function collectImportsFromWorkspace(
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

export async function getImportsByWorkspaceMap(
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

function getUndeclaredDependencies(
    dependencies: Set<string>,
    imports: Set<string>,
): Set<string> {
    const undeclaredDependencies: Set<string> = new Set()

    for (const importedPackage of imports) {
        if (!dependencies.has(importedPackage))
            undeclaredDependencies.add(importedPackage)
    }

    return undeclaredDependencies
}

function getUnusedDependencies(
    dependencies: Set<string>,
    imports: Set<string>,
): Set<string> {
    const unusedDependencies: Set<string> = new Set()

    for (const dependency of dependencies) {
        if (!imports.has(dependency)) unusedDependencies.add(dependency)
    }
    return unusedDependencies
}
