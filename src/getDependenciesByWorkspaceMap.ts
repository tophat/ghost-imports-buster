import { Descriptor, IdentHash, LocatorHash, Workspace } from '@yarnpkg/core'

import { Context, DependenciesMap } from './types'

async function getTransitivePeerDependencies(
    workspace: Workspace,
): Promise<Map<IdentHash, Descriptor>> {
    const transitivePeerDeps = new Map<IdentHash, Descriptor>()

    const manifest = workspace.manifest
    const locatorHashes = [
        ...manifest.getForScope('dependencies').values(),
        ...manifest.getForScope('devDependencies').values(),
        ...manifest.getForScope('peerDependencies').values(),
    ]
        .map((descriptor) =>
            workspace.project.storedResolutions.get(descriptor.descriptorHash),
        )
        .filter((hash: LocatorHash | undefined): hash is LocatorHash =>
            Boolean(hash),
        )

    for (const locatorHash of locatorHashes) {
        const pkg = workspace.project.storedPackages.get(locatorHash)
        if (!pkg) continue

        for (const [identHash, descriptor] of pkg.peerDependencies.entries()) {
            transitivePeerDeps.set(identHash, descriptor)
        }
    }

    return transitivePeerDeps
}

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
            transitivePeerDependencies: await getTransitivePeerDependencies(
                workspace,
            ),
        })
    }

    return dependenciesByWorkspace
}
