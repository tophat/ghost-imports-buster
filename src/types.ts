import {
    Configuration,
    Descriptor,
    IdentHash,
    Project,
    Workspace,
} from '@yarnpkg/core'

export type FileMatchPredicate = (filename: string) => boolean

export type PackageMatchPredicate = (packageName: string) => boolean

export interface Context {
    configuration: Configuration
    project: Project
    cwd: string
}

export interface AnalysisConfiguration {
    includeFiles: FileMatchPredicate
    excludeFiles: FileMatchPredicate
    excludePackages: PackageMatchPredicate
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

export type PackageResolutions = Map<string, string>

export interface Arguments {
    cwd?: string
    includeFiles?: string[]
    excludeFiles?: string[]
    excludePackages?: string[]
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
