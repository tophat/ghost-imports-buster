import { structUtils } from '@yarnpkg/core'

import { getConfiguration, getContext } from './utils'
import getImportsByWorkspaceMap from './getImportsFromWorkspaceMap'
import diffDependenciesAndImportsByWorkspace from './diffDependenciesAndImportsByWorkspace'
import getDependenciesByWorkspaceMap from './getDependenciesByWorkspaceMap'
import { Arguments, Report } from './types'
import fixWorkspaces from './fixWorkspaces'
import printReport from './printReport'

export default async function validateDependencies(
    args: Arguments,
): Promise<Report> {
    // Get context and configuration.
    const configuration = await getConfiguration(args)
    const context = await getContext(args.cwd)

    // Build dependencies and import map for all workspaces
    const dependenciesMap = await getDependenciesByWorkspaceMap(context)
    const importsMap = await getImportsByWorkspaceMap(context, configuration)

    // Diff dependencies and imports by workspace
    const diffReport = diffDependenciesAndImportsByWorkspace(
        context,
        dependenciesMap,
        importsMap,
    )

    const workspaceIdents: Set<string> = new Set()

    for (const workspace of context.project.workspaces) {
        if (!workspace.manifest?.name) throw new Error('MISSING_IDENT')
        const ident = structUtils.stringifyIdent(workspace.manifest.name)
        workspaceIdents.add(ident)
    }

    const report = {
        workspaces: workspaceIdents,
        undeclaredDependencies: diffReport.undeclared,
        unusedDependencies: diffReport.unused,
    }

    printReport(report)
    if (configuration.fix) await fixWorkspaces(context, diffReport)

    return report
}
