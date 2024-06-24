/**
 * Copyright (c) HashiCorp, Inc.
 */

import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as os from 'os'
import * as toolCache from '@actions/tool-cache'
import path from 'path'
import {
  releaseVersion,
  newestCompliantVersion,
  ProductRelease,
  Build
} from './releases'
import * as semver from 'semver'

if (require.main === module) {
  run()
}

export async function run(): Promise<void> {
  try {
    await realRun()
  } catch (err) {
    core.setFailed(`hashicorp/hcp-setup-action failed: ${err.message}`)
  }
}

async function realRun(): Promise<void> {
  let version = core.getInput('version')
  const projectId = core.getInput('project_id')

  // Possible version cases:
  //  - unset: check if there is an existing hcp version, if not download latest.
  //  - latest: download the latest version.
  //  - specific version: download the specific version.
  //  - version constraint: download the best matching version.
  if (!version) {
    version = '*'

    // Check if any version is already installed
    const toolPath = toolCache.find('hcp', version)
    if (toolPath !== '') {
      core.debug(`cached installation found`)
      core.addPath(path.join(toolPath, 'bin'))
      return
    }
  } else if (version === 'latest') {
    version = '*'
  }

  // Find a release that matches the desired version
  let hcpRelease: ProductRelease | null = null
  if (semver.valid(version)) {
    // We are given a specific version, so fetch its builds directly rather
    // than listing all versions.
    hcpRelease = await releaseVersion(version)
  } else {
    // We are given a version constraint, so fetch the released versions until
    // we find a compatible one.
    hcpRelease = await newestCompliantVersion(version)
  }

  // Check if the desired version is in the tool cache
  const toolPath = toolCache.find('hcp', hcpRelease.version)
  if (toolPath !== '') {
    core.debug(`cached installation found`)
    core.addPath(path.join(toolPath, 'bin'))
    return
  }

  // Download and install the desired version
  await installHCP(hcpRelease)

  // See if the CLI is authenticated.
  const exitCode = await exec.exec('hcp', ['auth', 'print-access-token'], {
    ignoreReturnCode: true
  })
  if (exitCode !== 0) {
    core.warning(
      `The hcp CLI is not authenticated. ` +
        `Authenticate by adding the "hashicorp/hcp-auth-action" step ` +
        `prior this one.`
    )
  }

  // Set the profile to be quiet, disabling prompting. This is not supported in
  // early versions of the CLI so we simply log a warning if it fails.
  try {
	await exec.exec('hcp', ['profile', 'set', 'core/quiet', 'true'])
  } catch (err) {
	core.warning(
	  `Failed to configure the profile to be quiet. ` +
		`This is not supported in versions < 0.4.0.`
	)
  }

  // If project_id is set, set the profile to use the project_id
  if (projectId) {
    await exec.exec('hcp', [
      'profile',
      'set',
      '--quiet',
      'project_id',
      projectId
    ])
  }
}
//**
// Install the desired version of HCP.
// @param release - The release to install.
// @returns A promise that resolves when the installation is complete.
// @throws An error if the installation fails.
// */
async function installHCP(release: ProductRelease): Promise<void> {
  // Determine the architecture
  let arch = ''
  switch (os.arch()) {
    case 'arm':
      arch = 'arm'
      break
    case 'arm64':
      arch = 'arm64'
      break
    case 'x64':
      arch = 'amd64'
      break
    case 'x32':
      arch = '386'
      break
    default:
      throw new Error(`unsupported architecture: ${os.arch()}`)
  }

  // Determine the platform
  let plat = ''
  switch (os.platform()) {
    case 'win32':
      plat = 'windows'
      break
    case 'darwin':
      plat = 'darwin'
      break
    case 'linux':
      plat = 'linux'
      break
    default:
      throw new Error(`unsupported platform: ${os.platform()}`)
  }

  // Find the build for the desired platform and architecture
  const b: Build | undefined = release.builds.find(
    build => build.arch === arch && build.os === plat
  )
  if (!b) {
    throw new Error(`no build found for ${plat} ${arch}`)
  }

  core.debug(
    `downloading and installing hcp: ${release.version}, ${plat}, ${arch}`
  )

  // Download the hcp binary
  let toolRoot = ''
  const toolName = `hcp${plat === 'windows' ? '.exe' : ''}`
  try {
    const zipPath = await toolCache.downloadTool(b.url)
    const extractedPath = await toolCache.extractZip(zipPath)
    toolRoot = path.join(extractedPath, toolName)
  } catch (err) {
    throw new Error(`failed to download hcp: ${err.message}`)
  }

  try {
    // Cache the downloaded hcp binary
    const toolPath = await toolCache.cacheFile(
      toolRoot,
      toolName,
      'hcp',
      release.version
    )
    core.addPath(toolPath)
  } catch (err) {
    throw new Error(`failed to cache hcp: ${err.message}`)
  }

  return
}
