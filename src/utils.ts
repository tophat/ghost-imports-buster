import { join, resolve } from 'path'
import { promises as fs, readdirSync, statSync } from 'fs'

import { Configuration, Project, Workspace, structUtils } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { PortablePath } from '@yarnpkg/fslib'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'

import { BabelParserNode, Context, PackagesByWorkspaceMap } from './types'

export async function getContext(cwd: string): Promise<Context> {
    const fullCwd = resolve(process.cwd(), cwd) as PortablePath
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, fullCwd)
    return { configuration, project, cwd: fullCwd }
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
export function collectPaths(root: string): Set<string> {
    const rootStat = statSync(root)

    if (!rootStat.isDirectory()) {
        return root.match(/\.js$/) ? new Set([root]) : new Set()
    }

    const directoryListing = readdirSync(root)

    const collectedPaths = directoryListing.reduce(
        (paths: string[], current: string): string[] => {
            return [...paths, ...collectPaths(join(root, current))]
        },
        [],
    )

    return new Set(collectedPaths)
}
export async function collectImportsFromWorkspace(
    workspace: Workspace,
): Promise<Set<string>> {
    const workspaceRoot = workspace.cwd
    const workspacePaths = collectPaths(workspaceRoot)

    const imports: Set<string> = new Set()

    const isRelativeImport = (imported: string): boolean =>
        imported.startsWith('.')

    for (const path of workspacePaths) {
        const content = await fs.readFile(path, { encoding: 'utf8' })
        const ast = parse(content, { sourceType: 'module' })

        traverse(ast, {
            ImportDeclaration: function (path: BabelParserNode) {
                const imported = path.node.source.value
                if (!isRelativeImport(imported)) imports.add(imported)
            },
            CallExpression: function (path: BabelParserNode) {
                const callee = path.node.callee.name
                const imported = path.node.arguments[0]?.value
                if (callee === 'require' && !isRelativeImport(imported))
                    imports.add(path.node.arguments.value)
            },
        })
    }

    return imports
}

export async function getImportsByWorkspaceMap(
    context: Context,
): Promise<PackagesByWorkspaceMap> {
    const workspaces = context.project.workspaces
    const importsMap: PackagesByWorkspaceMap = new Map()

    for (const workspace of workspaces) {
        const collectedImports = await collectImportsFromWorkspace(workspace)
        importsMap.set(workspace, collectedImports)
    }
    return importsMap
}

export function getUndeclaredDependencies(
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

export function getUnusedDependencies(
    dependencies: Set<string>,
    imports: Set<string>,
): Set<string> {
    const unusedDependencies: Set<string> = new Set()

    for (const dependency of dependencies) {
        if (!imports.has(dependency)) unusedDependencies.add(dependency)
    }
    return unusedDependencies
}
