import { Workspace, structUtils } from '@yarnpkg/core'
import fastGlob from 'fast-glob'

import {
    AnalysisConfiguration,
    Context,
    DependenciesMap,
    DiffReport,
    ImportRecord,
    ImportRecordsByWorkspaceMap,
} from './types'

export default async function diffDependenciesAndImportsByWorkspace(
    context: Context,
    configuration: AnalysisConfiguration,
    dependenciesMap: Map<Workspace, DependenciesMap>,
    importsMap: ImportRecordsByWorkspaceMap,
): Promise<DiffReport> {
    const { workspaces } = context.project
    const undeclaredDependenciesMap = new Map()
    const unusedDependenciesMap = new Map()
    for (const workspace of workspaces) {
        if (!workspace.manifest?.name) throw new Error('MISSING_IDENT')

        const workspaceIdent = structUtils.stringifyIdent(
            workspace.manifest.name,
        )

        const workspaceDependencies = dependenciesMap.get(workspace)
        const workspaceImports = importsMap.get(workspace)

        if (!workspaceDependencies || !workspaceImports) continue

        const undeclaredDependencies = await getUndeclaredDependencies(
            configuration,
            workspace,
            workspaceDependencies,
            workspaceImports,
        )
        const unusedDependencies = await getUnusedDependencies(
            configuration,
            workspace,
            workspaceDependencies,
            workspaceImports,
        )

        undeclaredDependenciesMap.set(workspaceIdent, undeclaredDependencies)
        unusedDependenciesMap.set(workspaceIdent, unusedDependencies)
    }

    return {
        undeclared: undeclaredDependenciesMap,
        unused: unusedDependenciesMap,
    }
}

async function getUndeclaredDependencies(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Promise<Set<string>> {
    const undeclaredDependencies: Set<string> = new Set()
    const devFiles = await fastGlob(configuration.devFiles, {
        cwd: workspace.cwd,
    })
    for (const { imported, importedFrom } of imports) {
        const importedIdent = structUtils.parseIdent(imported)
        const identHash = importedIdent.identHash

        // Undeclared if not in dep or peerdep
        // Allowed to be in dev if file matches dev glob.
        // TODO: Add config option for dev allowed glob

        if (dependenciesMap.dependencies.has(identHash)) continue

        if (
            dependenciesMap.devDependencies.has(identHash) &&
            devFiles.includes(importedFrom) //configuration.devFiles(importedFrom)
        )
            continue

        if (
            dependenciesMap.peerDependencies.has(identHash) &&
            !devFiles.includes(importedFrom) //configuration.devFiles(importedFrom)
        )
            continue

        undeclaredDependencies.add(imported)
    }

    return undeclaredDependencies
}

// TODO
//function getMovableDependencies(): void {}

async function getUnusedDependencies(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Promise<Set<string>> {
    const unusedDependencies: Set<string> = new Set()

    const importsUsage = new Map<string, Set<string>>()
    const devImportsUsage = new Map<string, Set<string>>()
    const devFiles = await fastGlob(configuration.devFiles, {
        cwd: workspace.cwd,
    })
    for (const { imported, importedFrom } of imports.values()) {
        if (
            devFiles.includes(
                importedFrom,
            ) /*configuration.devFiles(importedFrom)*/
        ) {
            const devSet = devImportsUsage.get(imported) ?? new Set<string>()
            devImportsUsage.set(imported, devSet)
            devSet.add(importedFrom)
        } else {
            const depSet = importsUsage.get(imported) ?? new Set<string>()
            importsUsage.set(imported, depSet)
            depSet.add(importedFrom)
        }
    }

    for (const dependencyDescriptor of dependenciesMap.dependencies.values()) {
        const dependencyName = structUtils.stringifyIdent(dependencyDescriptor)

        // Not considering ranges.
        if (
            dependenciesMap.transitivePeerDependencies.has(
                dependencyDescriptor.identHash,
            )
        ) {
            continue
        }

        if (
            importsUsage.has(dependencyName) ||
            dependenciesMap.binaries.has(dependencyDescriptor.identHash) ||
            configuration.excludePackages(dependencyName)
        ) {
            continue
        }
        unusedDependencies.add(dependencyName)
    }
    for (const dependencyDescriptor of dependenciesMap.devDependencies.values()) {
        const dependencyName = structUtils.stringifyIdent(dependencyDescriptor)

        // should we do this for dev as well outside of root?
        if (
            dependenciesMap.transitivePeerDependencies.has(
                dependencyDescriptor.identHash,
            )
        ) {
            continue
        }

        // Unused if devSet[dependency] is empty
        if (
            devImportsUsage.has(dependencyName) ||
            dependenciesMap.binaries.has(dependencyDescriptor.identHash) ||
            configuration.excludePackages(dependencyName)
        ) {
            continue
        }
        unusedDependencies.add(dependencyName)
    }

    return unusedDependencies
}
