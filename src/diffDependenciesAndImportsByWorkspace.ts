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

// TODO
function isDevFile(/*path: string*/): boolean {
    return false
}

function getUndeclaredDependencies(
    dependenciesMap: DependenciesMap,
    imports: Set<ImportRecord>,
): Set<string> {
    const undeclaredDependencies: Set<string> = new Set()

    for (const importRecord of imports) {
        const { imported, importedFrom } = importRecord

        // Undeclared if not in dep or peerdep
        // Allowed to be in dev if file matches dev glob.
        // TODO: Add config option for dev allowed glob

        if (dependenciesMap.dependencies.has(imported)) continue

        if (
            dependenciesMap.devDependencies.has(imported) &&
            isDevFile(importedFrom)
        )
            continue

        if (
            dependenciesMap.peerDependencies.has(imported) &&
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
        const descriptor = structUtils.parseDescriptor(imported)
        const ident = structUtils.stringifyIdent(descriptor)

        if (isDevFile(importedFrom)) {
            const devSet = devImportsUsage.get(ident) ?? new Set<string>()
            devImportsUsage.set(ident, devSet)
            devSet.add(importedFrom)
        } else {
            const depSet = importsUsage.get(ident) ?? new Set<string>()
            importsUsage.set(ident, depSet)
            depSet.add(importedFrom)
        }
    }

    for (const dependencyDescriptor of dependenciesMap.dependencies) {
        const dependencyIdent = structUtils.stringifyIdent(
            structUtils.parseDescriptor(dependencyDescriptor),
        )
        // Not considering ranges.
        if (dependenciesMap.transitivePeerDependencies.has(dependencyIdent))
            continue
        if (importsUsage.get(dependencyIdent)?.size) continue

        unusedDependencies.add(dependencyIdent)
    }
    for (const dependencyDescriptor of dependenciesMap.devDependencies) {
        const dependencyIdent = structUtils.stringifyIdent(
            structUtils.parseDescriptor(dependencyDescriptor),
        )
        // Unused if devSet[dependency] is empty
        if (devImportsUsage?.get(dependencyIdent)?.size) continue

        unusedDependencies.add(dependencyIdent)
    }

    return unusedDependencies
}
