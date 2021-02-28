import { structUtils } from '@yarnpkg/core'

import { Context, PackagesByWorkspaceMap } from './types'

export default async function getDependenciesByWorkspaceMap(
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
