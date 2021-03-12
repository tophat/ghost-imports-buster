import { structUtils } from '@yarnpkg/core'

import {
    Context,
    DiffReport,
    ImportRecord,
    ImportRecordsByWorkspaceMap,
    PackagesByWorkspaceMap,
} from './types'

export default function diffDependenciesAndImportsByWorkspace(
    context: Context,
    dependenciesMap: PackagesByWorkspaceMap,
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
        const workspaceDependencies =
            dependenciesMap.get(workspace) ?? new Set()
        const workspaceImports = importsMap.get(workspace) ?? new Set()

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

function getUndeclaredDependencies(
    dependencies: Set<string>,
    imports: Set<ImportRecord>,
): Set<string> {
    const undeclaredDependencies: Set<string> = new Set()

    const imported = new Set(
        [...imports].map((item: ImportRecord) => item.imported),
    )

    for (const importedPackage of imported) {
        if (!dependencies.has(importedPackage))
            undeclaredDependencies.add(importedPackage)
    }

    return undeclaredDependencies
}

function getUnusedDependencies(
    dependencies: Set<string>,
    imports: Set<ImportRecord>,
): Set<string> {
    const unusedDependencies: Set<string> = new Set()

    const imported = new Set(
        [...imports].map((item: ImportRecord) => item.imported),
    )

    for (const dependency of dependencies) {
        if (!imported.has(dependency)) unusedDependencies.add(dependency)
    }
    return unusedDependencies
}
