import { Workspace, structUtils } from '@yarnpkg/core'

import { Context, DependenciesMap } from './types'

export default async function getDependenciesByWorkspaceMap(
    context: Context,
): Promise<Map<Workspace, DependenciesMap>> {
    const dependenciesByWorkspace: Map<Workspace, DependenciesMap> = new Map()

    for (const workspace of context.project.workspaces) {
        const manifest = workspace.manifest
        const dependencies = new Set(
            [...manifest.getForScope('dependencies').values()].map(
                structUtils.stringifyDescriptor,
            ),
        )
        const devDependencies = new Set(
            [...manifest.getForScope('devDependencies').values()].map(
                structUtils.stringifyDescriptor,
            ),
        )
        const peerDependencies = new Set(
            [...manifest.getForScope('peerDependencies').values()].map(
                structUtils.stringifyDescriptor,
            ),
        )
        dependenciesByWorkspace.set(workspace, {
            dependencies,
            devDependencies,
            peerDependencies,
            transitivePeerDependencies: new Set<string>(),
        })
    }

    return dependenciesByWorkspace
}
