import chalk from 'chalk'

import {
    getContext,
    getDependenciesByWorkspaceMap,
    getImportsByWorkspaceMap,
    getUndeclaredDependencies,
    getUnusedDependencies,
} from './utils'

interface Arguments {
    cwd?: string
}

export default async function validateDependencies({
    cwd,
}: Arguments): Promise<void> {
    const context = await getContext(cwd)
    const dependenciesMap = await getDependenciesByWorkspaceMap(context)
    const importsMap = await getImportsByWorkspaceMap(context)

    const undeclaredDependenciesMap = new Map()
    const unusedDependenciesMap = new Map()
    for (const workspace of context.project.workspaces) {
        const workspaceDependencies = dependenciesMap.get(workspace)
        const workspaceImports = importsMap.get(workspace)

        const undeclaredDependencies = getUndeclaredDependencies(
            workspaceDependencies,
            workspaceImports,
        )
        const unusedDependencies = getUnusedDependencies(
            workspaceDependencies,
            workspaceImports,
        )

        undeclaredDependenciesMap.set(workspace, undeclaredDependencies)
        unusedDependenciesMap.set(workspace, unusedDependencies)
    }

    for (const workspace of context.project.workspaces) {
        const undeclared = undeclaredDependenciesMap.get(workspace)

        console.log(workspace.manifest.name.name)
        if (!undeclared.size) console.log('➝ No undeclared dependencies')
        else console.log([...undeclared].join('\n'))
    }
}
