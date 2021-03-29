import { IdentHash, Workspace, structUtils } from '@yarnpkg/core'
import fastGlob from 'fast-glob'

import {
    AnalysisConfiguration,
    Context,
    DependenciesMap,
    DiffReport,
    ImportRecord,
    ImportRecordsByWorkspaceMap,
    UndeclaredDependencyMap,
} from './types'

export default async function diffDependenciesAndImportsByWorkspace(
    context: Context,
    configuration: AnalysisConfiguration,
    dependenciesMap: Map<Workspace, DependenciesMap>,
    importsMap: ImportRecordsByWorkspaceMap,
): Promise<DiffReport> {
    const { workspaces } = context.project
    const undeclaredDependenciesMap: Map<
        string,
        UndeclaredDependencyMap
    > = new Map()
    const unusedDependenciesMap: Map<string, Set<string>> = new Map()
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

async function guessDependencyType({
    configuration,
    dependenciesMap,
    identHash,
    previousGuesses,
    packageName,
    isInDevFile,
}: {
    configuration: AnalysisConfiguration
    previousGuesses: UndeclaredDependencyMap
    dependenciesMap: DependenciesMap
    packageName: string
    isInDevFile: boolean
    identHash: IdentHash
}): Promise<'dependencies' | 'devDependencies' | 'peerDependencies'> {
    if (configuration.alwaysPeerDependencies(packageName)) {
        return 'peerDependencies'
    }

    const previousGuess = previousGuesses.get(packageName)
    if (previousGuess?.dependencyType === 'dependencies') {
        return previousGuess?.dependencyType
    }

    if (isInDevFile) return 'devDependencies'

    if (
        !previousGuess &&
        dependenciesMap.transitivePeerDependencies.has(identHash)
    ) {
        return 'peerDependencies'
    }

    return 'dependencies'
}

async function getUndeclaredDependencies(
    configuration: AnalysisConfiguration,
    workspace: Workspace,
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Promise<UndeclaredDependencyMap> {
    const undeclaredDependencies: UndeclaredDependencyMap = new Map()
    const devFiles = await fastGlob(configuration.devFiles, {
        cwd: workspace.cwd,
        absolute: true,
    })

    for (const { imported, importedFrom } of imports) {
        const importedIdent = structUtils.parseIdent(imported)
        const identHash = importedIdent.identHash

        // Undeclared if not in dep or peerdep
        // Allowed to be in dev if file matches dev glob.
        // TODO: Add config option for dev allowed glob

        if (dependenciesMap.dependencies.has(identHash)) continue

        const isInDevFile = devFiles.includes(importedFrom)

        if (dependenciesMap.devDependencies.has(identHash) && isInDevFile)
            continue

        if (dependenciesMap.peerDependencies.has(identHash) && !isInDevFile)
            continue

        const dependencyType = await guessDependencyType({
            previousGuesses: undeclaredDependencies,
            configuration,
            dependenciesMap,
            packageName: imported,
            identHash,
            isInDevFile,
        })
        undeclaredDependencies.set(imported, { dependencyType, importedFrom })
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
        if (devFiles.includes(importedFrom)) {
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
