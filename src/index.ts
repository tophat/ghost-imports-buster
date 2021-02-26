import { structUtils } from '@yarnpkg/core'

import {
    getContext,
    getDependenciesByWorkspaceMap,
    getImportsByWorkspaceMap,
    getUndeclaredDependencies,
    getUnusedDependencies,
} from './utils'
import { Arguments, Report } from './types'

export default async function validateDependencies({
    cwd,
}: Arguments): Promise<Report> {
    if (!cwd) cwd = process.cwd()

    const context = await getContext(cwd)
    const dependenciesMap = await getDependenciesByWorkspaceMap(context)
    const importsMap = await getImportsByWorkspaceMap(context)

    const undeclaredDependenciesMap = new Map()
    const unusedDependenciesMap = new Map()
    for (const workspace of context.project.workspaces) {
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

    const workspaceIdents: Set<string> = new Set()

    for (const workspace of context.project.workspaces) {
        if (!workspace.manifest?.name) throw new Error('MISSING_IDENT')
        const ident = structUtils.stringifyIdent(workspace.manifest.name)
        workspaceIdents.add(ident)
    }

    return {
        workspaces: workspaceIdents,
        undeclaredDependencies: undeclaredDependenciesMap,
        unusedDependencies: unusedDependenciesMap,
    }
}
