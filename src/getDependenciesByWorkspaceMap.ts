import {
    Descriptor,
    Ident,
    IdentHash,
    LocatorHash,
    Workspace,
    structUtils,
} from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'

import { Context, DependenciesMap } from './types'

async function getTransitivePeerDependencies(
    workspace: Workspace,
): Promise<Map<IdentHash, Descriptor>> {
    const transitivePeerDeps = new Map<IdentHash, Descriptor>()

    const locatorHashes = [...workspace.dependencies.values()]
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

async function getBinaries(
    workspace: Workspace,
): Promise<Map<IdentHash, Ident>> {
    const binaries = new Map<IdentHash, Ident>()

    if (
        !structUtils.areDescriptorsEqual(
            workspace.anchoredDescriptor,
            workspace.project.topLevelWorkspace.anchoredDescriptor,
        )
    ) {
        return binaries
    }

    const locatorHashes = [...workspace.dependencies.entries()]
        .filter(
            ([identHash]) =>
                !workspace.manifest.peerDependencies.has(identHash),
        )
        .map(([, descriptor]) =>
            workspace.project.storedResolutions.get(descriptor.descriptorHash),
        )
        .filter((hash: LocatorHash | undefined): hash is LocatorHash =>
            Boolean(hash),
        )

    for (const locatorHash of locatorHashes) {
        const pkg = workspace.project.storedPackages.get(locatorHash)
        if (pkg?.bin.size) binaries.set(pkg.identHash, pkg)
    }

    return binaries
}

export default async function getDependenciesByWorkspaceMap(
    context: Context,
): Promise<Map<Workspace, DependenciesMap>> {
    const dependenciesByWorkspace: Map<Workspace, DependenciesMap> = new Map()

    for (const workspaceCwd of context.workspaceCwds) {
        const workspace = context.project.getWorkspaceByCwd(
            npath.toPortablePath(workspaceCwd),
        )
        const manifest = workspace.manifest
        dependenciesByWorkspace.set(workspace, {
            dependencies: manifest.getForScope('dependencies'),
            devDependencies: manifest.getForScope('devDependencies'),
            peerDependencies: manifest.getForScope('peerDependencies'),
            transitivePeerDependencies: await getTransitivePeerDependencies(
                workspace,
            ),
            binaries: await getBinaries(workspace),
        })
    }

    return dependenciesByWorkspace
}
