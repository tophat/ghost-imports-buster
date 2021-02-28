import { Configuration, Project, Workspace } from '@yarnpkg/core'

export interface Context {
    configuration: Configuration
    project: Project
    cwd: string
}

export interface AnalysisConfiguration {
    includes: Set<string>
}

export type PackagesByWorkspaceMap = Map<Workspace, Set<string>>

export interface Arguments {
    cwd?: string
    includes?: string[]
}

export interface DiffReport {
    undeclared: Map<string, Set<string>>
    unused: Map<string, Set<string>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BabelParserNode = any

export interface Report {
    workspaces: Set<string>
    unusedDependencies: Map<string, Set<string>>
    undeclaredDependencies: Map<string, Set<string>>
}
