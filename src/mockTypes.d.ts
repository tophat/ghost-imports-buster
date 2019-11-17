/* eslint-disable @typescript-eslint/no-explicit-any */

import { Stats } from 'fs'

interface MockFileTreeItem {
    isDir: boolean
    name: string
    children: string[]
}

export interface MockFileTree {
    [property: string]: MockFileTreeItem
}

export interface MockStat extends Stats {
    isDirectory: any
    isFile: any
    [property: string]: any
}
