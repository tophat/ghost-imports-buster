import { IdentHash, Workspace, structUtils } from '@yarnpkg/core'
import { npmHttpUtils } from '@yarnpkg/plugin-npm'
import chalk from 'chalk'

import { Context, DiffReport } from './types'

export default async function fixWorkspaces(
    context: Context,
    diffReport: DiffReport,
): Promise<void> {
    const workspaces = context.project.workspaces
    console.log(`Attempting to fix ${workspaces.length} packages`)
    await Promise.all(
        workspaces.map(
            async (workspace: Workspace): Promise<void> => {
                const workspaceName = workspace?.manifest?.name

                if (!workspaceName) throw new Error('MISSING_WORKSPACE_NAME')

                const workspaceIdent = structUtils.stringifyIdent(workspaceName)
                fixWorkspace(
                    context,
                    workspace,
                    diffReport.undeclared.get(workspaceIdent) ?? new Set(),
                    diffReport.unused.get(workspaceIdent) ?? new Set(),
                )
            },
        ),
    )
}

async function fixWorkspace(
    context: Context,
    workspace: Workspace,
    undeclaredDependencies: Set<string>,
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

    // Collect idents to add.
    const dependenciesToAdd = new Map()
    for (const dependency of undeclaredDependencies) {
        try {
            const dependencyIdent = structUtils.tryParseIdent(dependency)

            if (!dependencyIdent) throw new Error('MISSING_DEPENDENCY_IDENT')

            const identUrl = npmHttpUtils.getIdentUrl(dependencyIdent)
            const distTagUrl = `/-/package${identUrl}/dist-tags`
            const result = await npmHttpUtils.get(distTagUrl, {
                configuration: context.configuration,
                ident: dependencyIdent,
                jsonResponse: true,
            })

            dependenciesToAdd.set(
                dependencyIdent.identHash,
                structUtils.makeDescriptor(
                    dependencyIdent,
                    `^${result.latest}`,
                ),
            )
        } catch (e) {
            if (e.name === 'HTTPError' && e.response.statusCode === 404) {
                /* Package does not exist in the registry. */
            } else {
                throw e
            }
        }
    }

    for (const dependencyIdentHash of dependenciesToRemove)
        workspace.manifest.dependencies.delete(dependencyIdentHash as IdentHash)

    for (const dependency of dependenciesToAdd) {
        const [identHash, descriptor] = dependency
        workspace.manifest.dependencies.set(identHash, descriptor)
    }
    console.log(
        chalk.green(
            `(${workspaceIdent}) added ${dependenciesToAdd.size} packages and removed ${dependenciesToRemove.size}.`,
        ),
    )
    await workspace.persistManifest()
}
