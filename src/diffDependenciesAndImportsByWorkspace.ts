import path from 'path'

import { Workspace, structUtils } from '@yarnpkg/core'

import {
    Context,
    DependenciesMap,
    DiffReport,
    ImportRecord,
    ImportRecordsByWorkspaceMap,
} from './types'

export default function diffDependenciesAndImportsByWorkspace(
    context: Context,
    dependenciesMap: Map<Workspace, DependenciesMap>,
    importsMap: ImportRecordsByWorkspaceMap,
): DiffReport {
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

    return {
        undeclared: undeclaredDependenciesMap,
        unused: unusedDependenciesMap,
    }
}

// TODO: allow customization over default
function isDevFile(filename: string): boolean {
    const parts = filename.split(path.sep)
    if (parts.some((p) => ['__tests__', 'tests'].includes(p))) {
        return true
    }
    if (filename.includes('.test.')) {
        return true
    }
    return false
}

function getUndeclaredDependencies(
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Set<string> {
    const undeclaredDependencies: Set<string> = new Set()

    for (const { imported, importedFrom } of imports) {
        const importedIdent = structUtils.parseIdent(imported)
        const identHash = importedIdent.identHash

        // Undeclared if not in dep or peerdep
        // Allowed to be in dev if file matches dev glob.
        // TODO: Add config option for dev allowed glob

        if (dependenciesMap.dependencies.has(identHash)) continue

        if (
            dependenciesMap.devDependencies.has(identHash) &&
            isDevFile(importedFrom)
        )
            continue

        if (
            dependenciesMap.peerDependencies.has(identHash) &&
            !isDevFile(importedFrom)
        )
            continue

        undeclaredDependencies.add(imported)
    }

    return undeclaredDependencies
}

// TODO
//function getMovableDependencies(): void {}

function getUnusedDependencies(
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Set<string> {
    const unusedDependencies: Set<string> = new Set()

    const importsUsage = new Map<string, Set<string>>()
    const devImportsUsage = new Map<string, Set<string>>()

    for (const { imported, importedFrom } of imports.values()) {
        if (isDevFile(importedFrom)) {
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

        if (importsUsage.get(dependencyName)?.size) continue

        unusedDependencies.add(dependencyName)
    }
    for (const dependencyDescriptor of dependenciesMap.devDependencies.values()) {
        const dependencyName = structUtils.stringifyIdent(dependencyDescriptor)
        // Unused if devSet[dependency] is empty
        if (devImportsUsage?.get(dependencyName)?.size) continue

        unusedDependencies.add(dependencyName)
    }

    return unusedDependencies
}
