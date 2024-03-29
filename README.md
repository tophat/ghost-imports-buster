> **This project was an idea we had that we weren't able to dedicate the resources to see it through. For this reason, we've archived this repository for now. If there's interest, we may unarchive it.**

# Ghost Imports Buster
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->
[![codecov](https://codecov.io/gh/tophat/ghost-imports-buster/branch/master/graph/badge.svg)](https://codecov.io/gh/tophat/ghost-imports-buster)
![Build](https://github.com/tophat/ghost-imports-buster/workflows/Node.js%20CI/badge.svg?branch=master)

###### :ghost: I ain't afraid of no ghost

---

## A tale of well-defined dependencies

Because of [how NodeJS import resolution works](https://nodejs.org/api/modules.html#modules_all_together), it is possible for packages that are not part of your project's `package.json` to be resolved by `import` and `require` statements in your code. This creates a "works on machine" scenario where your code depends on packages installed outside of their respective projects, causing failures for whoever consumes your packages and does not have the same global installs. 

With the `ghost-imports-buster` dependency validator, you can monitor dependencies declared in your `package.json` files and compare them against what is actually imported in your code. It then becomes easy to find and eliminate extraneous dependencies (which are declared, but not used anywhere) and fix ghost dependencies (which are not declared, but imported in code).

## Installation

```
yarn add ghost-imports-buster -D
```

## Usage

```
yarn ghost-imports-buster [--cwd <cwd>] [--include <inclusion glob>]
```

## Configuration

You can pass in parameters to the ghost import call to customize the analysis:

|Parameter|Type|Description|
|---|---|---|
|`cdw`|`string`|Directory root to execute the validation from, defaults to `.`|
|`include`|`string`|Glob to filter files to include when looking for imports, can be used multiple times to define multiple globs. Defaults to `**/*`|
|`exclude`|`string`|Glob to filter files to exclude when looking for imports. Same usage as `include`|
|`fix`|`boolean`|When set, unused dependencies are removed and undeclared ones, added. This adds `latest` if available.|

## Autofixing

By default, `ghost-imports-buster` will attempt to resolve undeclared packages the (loosely) same way [node's `require` will](https://nodejs.org/api/modules.html#modules_all_together): by crawling from the current working directory and checking in every `node_modules` in its path to the file system root. If a package cannot be resolved, the `latest` from the registry will be used instead.

## Contributing


## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://mcataford.github.io"><img src="https://avatars2.githubusercontent.com/u/6210361?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Marc Cataford</b></sub></a><br /><a href="#ideas-mcataford" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Code">💻</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Tests">⚠️</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Documentation">📖</a> <a href="#infra-mcataford" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://opensource.tophat.com"><img src="https://avatars.githubusercontent.com/u/6020693?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Shouvik DCosta</b></sub></a><br /><a href="#infra-sdcosta" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://noahnu.com"><img src="https://avatars.githubusercontent.com/u/1297096?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Noah</b></sub></a><br /><a href="https://github.com/tophat/ghost-imports-buster/commits?author=noahnu" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
