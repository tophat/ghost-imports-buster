import path from 'path'
import { promises as fs } from 'fs'

import {
    Descriptor,
    IdentHash,
    Manifest,
    Workspace,
    structUtils,
} from '@yarnpkg/core'
import { PortablePath } from '@yarnpkg/fslib'
import { npmHttpUtils } from '@yarnpkg/plugin-npm'
import chalk from 'chalk'

import {
    Context,
    DiffReport,
    PackageResolutions,
    UndeclaredDependencyMap,
} from './types'

export default async function fixWorkspaces(
    context: Context,
    diffReport: DiffReport,
): Promise<void> {
    const { workspaces } = context.project
    const resolvedVersionsFromNodeModules = await maybeResolvePackageVersionsFromNodeModules(
        context,
    )
    console.log(`Attempting to fix ${workspaces.length} packages`)
    await Promise.all(
        workspaces.map(
            async (workspace: Workspace): Promise<void> => {
                const workspaceName = workspace?.manifest?.name

                if (!workspaceName) throw new Error('MISSING_WORKSPACE_NAME')

                const workspaceIdent = structUtils.stringifyIdent(workspaceName)
                await fixWorkspace(
                    context,
                    workspace,
                    resolvedVersionsFromNodeModules,
                    diffReport.undeclared.get(workspaceIdent) ?? new Map(),
                    diffReport.unused.get(workspaceIdent) ?? new Set(),
                )
            },
        ),
    )
}

async function fixWorkspace(
    context: Context,
    workspace: Workspace,
    resolvedVersionsFromNodeModules: Map<string, string>,
    undeclaredDependencies: UndeclaredDependencyMap,
    unusedDependencies: Set<string>,
): Promise<void> {
    const workspaceName = workspace?.manifest?.name

    if (!workspaceName) throw new Error('MISSING_WORKSPACE_NAME')

    const workspaceIdent = structUtils.stringifyIdent(workspaceName)

    // Collect idents for removal.
    const dependenciesToRemove = new Set(
        [...unusedDependencies]
            .map(
                (dependency: string): IdentHash | undefined =>
                    structUtils.tryParseIdent(dependency)?.identHash,
            )
            .filter((ident) => ident),
    )

    const toAdd = {
        dependencies: new Map<IdentHash, Descriptor>(),
        devDependencies: new Map<IdentHash, Descriptor>(),
        peerDependencies: new Map<IdentHash, Descriptor>(),
    }

    const distTagsCache = new Map<IdentHash, string>()

    for (const [
        dependency,
        undeclaredMap,
    ] of undeclaredDependencies.entries()) {
        try {
            const dependencyIdent = structUtils.tryParseIdent(dependency)

            if (!dependencyIdent) throw new Error('MISSING_DEPENDENCY_IDENT')

            const dependencySet = toAdd[undeclaredMap.dependencyType]

            if (resolvedVersionsFromNodeModules.has(dependency)) {
                dependencySet.set(
                    dependencyIdent.identHash,
                    structUtils.makeDescriptor(
                        dependencyIdent,
                        `^${resolvedVersionsFromNodeModules.get(dependency)}`,
                    ),
                )
                continue
            }

            const identUrl = npmHttpUtils.getIdentUrl(dependencyIdent)
            const distTagUrl = `/-/package${identUrl}/dist-tags`
            const result = await npmHttpUtils.get(distTagUrl, {
                configuration: context.configuration,
                ident: dependencyIdent,
                jsonResponse: true,
            })

            const cachedVersion = distTagsCache.get(dependencyIdent.identHash)
            if (cachedVersion) {
                dependencySet.set(
                    dependencyIdent.identHash,
                    structUtils.makeDescriptor(dependencyIdent, cachedVersion),
                )
            } else {
                const version = result.latest ? `^${result.latest}` : '*'

                distTagsCache.set(dependencyIdent.identHash, version)

                dependencySet.set(
                    dependencyIdent.identHash,
                    structUtils.makeDescriptor(dependencyIdent, version),
                )
            }
        } catch (e) {
            if (e.name === 'HTTPError' && e.response.statusCode === 404) {
                /* Package does not exist in the registry. */
            } else {
                throw e
            }
        }
    }

    for (const dependencyIdentHash of dependenciesToRemove) {
        if (dependencyIdentHash) {
            workspace.manifest.dependencies.delete(dependencyIdentHash)
        }
    }

    let addedDepCount = 0

    for (const [dependencySet, dependenciesToAdd] of Object.entries(toAdd)) {
        for (const dependency of dependenciesToAdd) {
            const [identHash, descriptor] = dependency
            workspace.manifest
                .getForScope(dependencySet)
                .set(identHash, descriptor)
        }
        addedDepCount += dependenciesToAdd.size
    }

    console.log(
        chalk.green(
            `(${workspaceIdent}) added ${addedDepCount} packages and removed ${dependenciesToRemove.size}.`,
        ),
    )
    await workspace.persistManifest()
}

/*
 * Resolver for node_modules, crawls upwards from cwd to find any node_modules that
 * could be picked up at runtime and collects versions. The closest version available
 * for a given package is the resolved one.
 */
async function maybeResolvePackageVersionsFromNodeModules(
    context: Context,
): Promise<PackageResolutions> {
    const resolutions: PackageResolutions = new Map()

    const cwd = context.cwd
    const stepsBack = path.resolve(cwd).split(path.sep)

    while (stepsBack.length > 0) {
        stepsBack.pop()

        const currentPath = stepsBack.join(path.sep) || path.sep
        const surroundings = await fs.readdir(currentPath)

        if (surroundings.includes('node_modules')) {
            const modulePath = path.resolve(currentPath, 'node_modules')
            const moduleDirs = await fs.readdir(modulePath)

            for (const moduleDir of moduleDirs) {
                if (moduleDir.startsWith('.')) continue
                const manifest = await Manifest.find(
                    path.resolve(modulePath, moduleDir) as PortablePath,
                )
                if (!manifest.name) continue
                const packageName = structUtils.stringifyIdent(manifest.name)
                if (
                    manifest.version &&
                    packageName &&
                    !resolutions.has(packageName)
                )
                    resolutions.set(packageName, manifest.version)
            }
        }
    }

    return resolutions
}
