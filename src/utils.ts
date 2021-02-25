import { join, resolve } from 'path'
import { promises as fs, readdirSync, statSync } from 'fs'

import { Configuration, Project, Workspace } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'

interface Context {
    configuration: Configuration
    project: Project
    cwd: string
}

export async function getContext(cwd: string): Context {
    const fullCwd = resolve(process.cwd(), cwd)
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, fullCwd)
    return { configuration, project, cwd: fullCwd }
}

// TODO: Any
export async function getDependenciesByWorkspaceMap(context: Context): any {
    const dependenciesByWorkspace = new Map()

    for (const workspace of context.project.workspaces) {
        const dependencies = [...workspace.manifest.dependencies.values()].map(
            dependency => {
                // TODO: Use ident?
                if (dependency.scope)
                    return `${dependency.scope}/${dependency.name}`
                else return dependency.name
            },
        )

        dependenciesByWorkspace.set(workspace, new Set(dependencies))
    }

    return dependenciesByWorkspace
}

// TODO: any
export async function getImportsByWorkspaceMap(context: Context): any {
    const workspaces = context.project.workspaces
    const importsMap = new Map()

    for (const workspace of workspaces) {
        const collectedImports = await collectImportsFromWorkspace(workspace)
        importsMap.set(workspace, collectedImports)
    }
    return importsMap
}

export async function collectImportsFromWorkspace(
    workspace: Workspace,
): Promise<Set<string>> {
    const workspaceRoot = workspace.cwd
    const workspacePaths = collectPaths(workspaceRoot)

    const imports = new Set()

    for (const path of workspacePaths) {
        const content = await fs.readFile(path, { encoding: 'utf8' })
        const ast = parse(content, { sourceType: 'module' })

        traverse(ast, {
            // TODO: Other types of import decl.
            ImportDeclaration: function(path) {
                imports.add(path.node.source.value)
            },
        })
    }

    return imports
}

export function collectPaths(root: string): Set<string> {
    const rootStat = statSync(root)

    if (!rootStat.isDirectory()) {
        return root.match(/\.js$/) ? [root] : []
    }

    const directoryListing = readdirSync(root)

    return directoryListing.reduce((paths, current) => {
        return [...paths, ...collectPaths(join(root, current))]
    }, [])
}

export function getUndeclaredDependencies(dependencies, imports) {
    const undeclaredDependencies = new Set()

    for (const importedPackage of imports) {
        if (!dependencies.has(importedPackage))
            undeclaredDependencies.add(importedPackage)
    }

    return undeclaredDependencies
}

export function getUnusedDependencies(dependencies, imports) {
    const unusedDependencies = new Set()

    for (const dependency of dependencies) {
        if (!imports.has(dependency)) unusedDependencies.add(dependency)
    }
    return unusedDependencies
}
