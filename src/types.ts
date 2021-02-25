import { Configuration, Project, Workspace } from '@yarnpkg/core'

export interface Context {
    configuration: Configuration
    project: Project
    cwd: string
}

export type PackagesByWorkspaceMap = Map<Workspace, Set<string>>
