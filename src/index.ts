import { structUtils } from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'

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
    const context = await getContext(configuration, args.cwd)
    await context.project.restoreInstallState()

    // Build dependencies and import map for all workspaces
    const dependenciesMap = await getDependenciesByWorkspaceMap(context)
    const importsMap = await getImportsByWorkspaceMap(context, configuration)

    // Diff dependencies and imports by workspace
    const diffReport = await diffDependenciesAndImportsByWorkspace(
        context,
        configuration,
        dependenciesMap,
        importsMap,
    )

    const workspaceIdents: Set<string> = new Set()

    for (const workspaceCwd of context.workspaceCwds) {
        const workspace = context.project.getWorkspaceByCwd(
            npath.toPortablePath(workspaceCwd),
        )
        if (!workspace.manifest?.name) throw new Error('MISSING_IDENT')
        const ident = structUtils.stringifyIdent(workspace.manifest.name)
        workspaceIdents.add(ident)
    }

    const report = {
        workspaces: workspaceIdents,
        undeclaredDependencies: diffReport.undeclared,
        unusedDependencies: diffReport.unused,
    }
    console.log(report)
    printReport(report)
    if (configuration.fix) await fixWorkspaces(context, diffReport)

    return report
}
