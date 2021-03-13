import {
    Configuration,
    Descriptor,
    IdentHash,
    Project,
    Workspace,
} from '@yarnpkg/core'

export interface Context {
    configuration: Configuration
    project: Project
    cwd: string
}

export interface AnalysisConfiguration {
    include: Set<string>
    exclude: Set<string>
    fix: boolean
}

export interface ImportRecord {
    importedFrom: string
    imported: string
}

export type ImportRecordsByWorkspaceMap = Map<Workspace, Set<ImportRecord>>

// TODO: Names are hard.
export interface DependenciesMap {
    dependencies: Map<IdentHash, Descriptor>
    devDependencies: Map<IdentHash, Descriptor>
    peerDependencies: Map<IdentHash, Descriptor>
    transitivePeerDependencies: Map<IdentHash, Descriptor>
}

// TODO: Deprecate
export type PackagesByWorkspaceMap = Map<Workspace, Set<string>>

export type PackageResolutions = Map<string, string>

export interface Arguments {
    cwd?: string
    include?: string[]
    exclude?: string[]
    fix?: boolean
}

export interface DiffReport {
    undeclared: Map<string, Set<string>>
    unused: Map<string, Set<string>>
}

export interface Report {
    workspaces: Set<string>
    unusedDependencies: Map<string, Set<string>>
    undeclaredDependencies: Map<string, Set<string>>
}
