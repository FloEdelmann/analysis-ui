import React from 'react'

import {loadBundles} from 'lib/actions'
import {loadProjectAndModifications, loadProjects} from 'lib/actions/project'
import {loadRegion} from 'lib/actions/region'
import List from 'lib/components/modification/list'
import SelectProject from 'lib/components/select-project'
import withInitialFetch from 'lib/with-initial-fetch'

const noProjectId = pid => !pid || pid === 'undefined'

/**
 * Show Select Project if a project has not been selected
 */
function Modifications(p) {
  if (noProjectId(p.query.projectId)) {
    return <SelectProject {...p} />
  } else {
    return <List {...p} />
  }
}

/**
 * Populates props with bundle, feeds, modifications, and project.
 */
async function initialFetch(store, query) {
  const {projectId, regionId} = query
  if (noProjectId(projectId)) {
    const [region, bundles, projects] = await Promise.all([
      store.dispatch(loadRegion(regionId)),
      store.dispatch(loadBundles({regionId})),
      store.dispatch(loadProjects({regionId}))
    ])
    return {bundles, projects, region}
  } else {
    return store.dispatch(loadProjectAndModifications(projectId))
  }
}

export default withInitialFetch(Modifications, initialFetch, {clientOnly: true})
