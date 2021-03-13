import { Descriptor, IdentHash, Workspace } from '@yarnpkg/core'

import { Context, DependenciesMap } from './types'

export default async function getDependenciesByWorkspaceMap(
    context: Context,
): Promise<Map<Workspace, DependenciesMap>> {
    const dependenciesByWorkspace: Map<Workspace, DependenciesMap> = new Map()

    for (const workspace of context.project.workspaces) {
        const manifest = workspace.manifest
        dependenciesByWorkspace.set(workspace, {
            dependencies: manifest.getForScope('dependencies'),
            devDependencies: manifest.getForScope('devDependencies'),
            peerDependencies: manifest.getForScope('peerDependencies'),
            transitivePeerDependencies: new Map<IdentHash, Descriptor>(),
        })
    }

    return dependenciesByWorkspace
}
