/**
 * Copyright (c) HashiCorp, Inc.
 */

import * as semver from 'semver'
import * as core from '@actions/core'
import { HttpClient } from '@actions/http-client'

// Interface for the build of a product
export interface Build {
  arch: string
  os: string
  url: string
}

// Interface for a single product release metadata
export interface ProductRelease {
  version: string
  name: string
  is_prerelease: boolean
  timestamp_created: string
  builds: Build[]
}

/**
 * Returns the best matching version for the given version spec.
 * @param versionSpec The version spec to match.
 * @returns The ProductRelease info for the newest matching version.
 * @throws An error if no matching version is found.
 */
export async function newestCompliantVersion(
  versionSpec: string
): Promise<ProductRelease> {
  try {
    // Create the HTTP client
    const client = new HttpClient('hcp-setup-action')

    // Store the next page token
    let nextPage = ''
    let oldestRelease: number = Number.MAX_VALUE

    // Loop until we find a release that meets the constraint or exhaust all pages
    do {
      const query = nextPage ? `&after=${nextPage}` : ''
      const url = `https://api.releases.hashicorp.com/v1/releases/hcp?limit=20${query}`
      core.debug(`Fetching releases from ${url}`)
      const response = await client.getJson<ProductRelease[]>(url)

      if (!response.result || response.result.length === 0) {
        throw new Error(
          `No releases found${nextPage ? ` after ${nextPage}` : ''}`
        )
      }

      for (const release of response.result) {
        if (semver.satisfies(release.version, versionSpec)) {
          return release
        }

        // Check if this is the oldest release and compare with oldest release
        const timestamp = Date.parse(release.timestamp_created)
        if (timestamp < oldestRelease) {
          oldestRelease = timestamp
          nextPage = release.timestamp_created
        }
      }
    } while (nextPage)

    // No release found that meets the constraint
    throw new Error(`No releases satisfy version constraint ${versionSpec}`)
  } catch (err) {
    throw new Error(`Failed to discover compatible hcp release: ${err.message}`)
  }
}

/**
 * Returns the release info for the given version.
 * @param version The specific version to download.
 * @returns The ProductRelease info for the version.
 */
export async function releaseVersion(version: string): Promise<ProductRelease> {
  try {
    // Create the HTTP client
    const client = new HttpClient('hcp-setup-action')
    const url = `https://api.releases.hashicorp.com/v1/releases/hcp/${version}`
    core.debug(`Fetching release version from ${url}`)
    const response = await client.getJson<ProductRelease>(url)
    if (!response.result) {
      throw new Error(`No release found for version ${version}`)
    }

    return response.result
  } catch (err) {
    throw new Error(
      `Failed to retrieve hcp release for version ${version}: ${err.message}`
    )
  }
}
