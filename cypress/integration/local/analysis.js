/* eslint-disable cypress/no-unnecessary-waiting */

function setCustom(settingKey, newValue, scenario = 'primary') {
  // sets a value in the "Customize Profile Request" box
  let newConfig = {}
  cy.get(`@${scenario}`)
    .findByLabelText(/Customize Profile Request/i)
    .as('profile')
    .invoke('val')
    .then((currentConfig) => {
      newConfig = JSON.parse(currentConfig)
      newConfig[settingKey] = newValue
      cy.get('@profile')
        .invoke('val', JSON.stringify(newConfig, null, 2))
        .type(' {backspace}')
      // TODO this last .type() triggers some kind of event that updates
      // the map. Ideally we would hit this directly with .trigger()
    })
}

function setOrigin(latLonArray) {
  setCustom('fromLat', latLonArray[0])
  setCustom('fromLon', latLonArray[1])
}

function fetchResults() {
  cy.findByText(/Fetch results/i)
    .click()
    .wait(200)
  // fetch results button usually disappears when clicked, but may not always
  // when it returns, we know the results have been fetched
  cy.findByText(/Fetch results/i, {timeout: 60000}).should('exist')
}

function setTimeCutoff(minutes) {
  // TODO this does not work yet
  cy.findByLabelText(/Time cutoff/i)
    .parent()
    .findByRole('slider')
    .invoke('val', minutes)
    .trigger('input', {force: true})
}

function asInt(numericText) {
  // parse formatted numbers with thousands separators
  return parseInt(numericText.replace(',', ''))
}

context('Analysis', () => {
  before(() => {
    cy.setup('project')
    cy.setup('opportunities')
  })

  beforeEach(() => {
    // refresh analysis page each time by navigating away and then back
    cy.navTo('projects')
    cy.navTo('Analyze')
    // alias all the things!
    cy.fixture('regions/scratch.json').as('region')
    cy.fixture('regions/scratch-results.json').as('results')
    cy.get('div.leaflet-container').as('map')
    cy.get('div#PrimaryAnalysisSettings').as('primary')
    cy.get('div#ComparisonAnalysisSettings').as('comparison')
    // set a standard project and scenario for all tests
    cy.get('@primary')
      .findByLabelText(/^Project$/)
      .click({force: true})
      .type('scratch{enter}')
    cy.get('@primary')
      .findByLabelText(/^Scenario$/)
      .click({force: true})
      .type('baseline{enter}')
    cy.findByLabelText(/^Opportunity Dataset$/)
      .click({force: true})
      .type(`default{enter}`)
      .wait(100)
    cy.findByLabelText(/^Opportunity Dataset$/).should('be.enabled')
    cy.get('@primary').findByLabelText(/Date/i).clear().type('2020-07-20')
  })

  context('of a point', () => {
    it('has all form elements', function () {
      // note that elements touched in beforeEach are neglected here
      cy.findByLabelText(/Time cutoff/i)
      cy.findByLabelText(/Travel time percentile/i)
      cy.get('@primary')
        .findByRole('button', {name: 'Regional analysis'})
        .should('be.disabled')
      cy.get('@primary').contains('scratch project')
      cy.get('@primary').contains('Baseline')
      cy.get('@primary').findAllByLabelText(/Bookmark/)
      cy.get('@primary').findByLabelText(/Access mode/i)
      cy.get('@primary').findByLabelText(/Transit modes/i)
      cy.get('@primary').findByLabelText(/Egress mode/i)
      cy.findByLabelText(/Walk speed/i)
      cy.findByLabelText(/Max walk time/i)
      cy.get('@primary').findByLabelText(/Date/i)
      cy.findByLabelText(/From time/i)
      cy.findByLabelText(/To time/i)
      cy.get('@primary').findByLabelText(/Simulated Schedules/i)
      cy.get('@primary').findByLabelText(/Maximum transfers/i)
      cy.findByLabelText(/Routing engine/i)
      cy.get('@primary').findAllByLabelText(/Bounds of analysis/i)
      cy.get('@primary').findByLabelText(/Customize Profile Request/i)
      cy.findByText(/Fetch results/i).should('be.enabled')
      fetchResults()
      cy.findByLabelText('Opportunities within isochrone')
        .invoke('text')
        .then((text) => {
          expect(text).to.match(/^\d+$/)
        })
    })

    it('runs, giving reasonable results', function () {
      // tests basic single point analysis at specified locations
      fetchResults() // initialize request
      // set new parameters
      setTimeCutoff(75)
      // move marker and align map for snapshot
      for (let key in this.region.locations) {
        let location = this.region.locations[key]
        setOrigin(location)
        cy.centerMapOn(location)
        fetchResults()
        cy.findByLabelText('Opportunities within isochrone')
          .invoke('text')
          .then((val) => {
            expect(asInt(val)).to.equal(this.results.locations[key].default)
          })
      }
    })

    it('handles direct access by walk/bike only', function () {
      const location = this.region.locations.middle
      const results = this.results.locations.middle
      setOrigin(location)
      cy.centerMapOn(location)
      // turn off all transit
      cy.get('@primary')
        .findByLabelText(/Transit modes/i)
        .findByRole('button', {name: /All/i})
        .click()
      cy.get('@primary')
        .findByLabelText(/Access mode/i)
        .should('not.exist')
      // it has changed names, becoming:
      cy.get('@primary')
        .findByLabelText(/Direct mode/i)
        .findByTitle(/Bike/i)
        .click()
      cy.get('@primary')
        .findByLabelText(/Egress mode/i)
        .findAllByRole('button')
        .should('be.disabled')
      fetchResults()
      cy.findByLabelText('Opportunities within isochrone')
        .invoke('text')
        .then((val) => {
          expect(asInt(val)).to.equal(results['bike-only'])
        })
      cy.get('svg#results-chart')
        .scrollIntoView()
        .matchImageSnapshot('direct-bike-access-chart')
    })

    it('uses custom analysis bounds', function () {
      const location = this.region.locations.center
      const results = this.results.locations.center
      setOrigin(location)
      cy.centerMapOn(location)
      setCustom('bounds', this.region.customRegionSubset)
      fetchResults()
      cy.findByLabelText('Opportunities within isochrone')
        .invoke('text')
        .then((val) => {
          expect(asInt(val)).to.equal(results['custom-bounds'])
        })
    })

    it('gives different results at different times', function () {
      const location = this.region.locations.center
      const results = this.results.locations.center
      setOrigin(location)
      cy.centerMapOn(location)
      // set time window in morning rush -- should have high access
      cy.findByLabelText(/From time/i)
        .as('from')
        .clear()
        .type('06:00')
      cy.findByLabelText(/To time/i)
        .as('to')
        .clear()
        .type('08:00')
      fetchResults()
      cy.findByLabelText('Opportunities within isochrone')
        .as('results')
        .invoke('text')
        .then((val) => {
          expect(asInt(val)).to.equal(results['6:00-8:00'])
        })
      // set time window in late evening - lower access
      cy.get('@from').clear().type('22:00')
      cy.get('@to').clear().type('24:00')
      fetchResults()
      cy.get('@results')
        .invoke('text')
        .then((val) => {
          expect(asInt(val)).to.equal(results['22:00-24:00'])
        })
      // narrow window to one minute - no variability
      cy.get('@from').clear().type('12:00')
      cy.get('@to').clear().type('12:01')
      fetchResults()
      cy.get('svg#results-chart')
        .scrollIntoView()
        .matchImageSnapshot('chart-no-variation')
    })

    it('charts accessibility', function () {
      const location = this.region.locations.center
      setOrigin(location)
      fetchResults()
      cy.get('svg#results-chart')
        .as('chart')
        .scrollIntoView()
        .matchImageSnapshot('single-scenario-chart')
      // add a comparison case to the chart
      cy.get('@comparison')
        .findByLabelText(/^Project$/)
        .click({force: true})
        .type('scratch{enter}')
      cy.get('@comparison')
        .findByLabelText(/^Scenario$/)
        .click({force: true})
        .type('baseline{enter}')
      // change the mode
      cy.get('@comparison')
        .findByLabelText(/Identical request settings/i)
        .uncheck({force: true})
      cy.get('@comparison')
        .findByLabelText(/Access mode/i)
        .findByTitle(/Bike/i)
        .click()
      fetchResults()
      cy.get('@chart')
        .scrollIntoView()
        .matchImageSnapshot('chart-with-comparison')
    })

    it('sets a bookmark')
  })

  context('of a region', () => {
    it('runs a regional analysis', function () {
      const analysisName = Cypress.env('dataPrefix') + 'regional_' + Date.now()
      setCustom('bounds', this.region.customRegionSubset)
      fetchResults()
      // start the analysis
      cy.get('@primary')
        .findByRole('button', {name: 'Regional analysis'})
        .should('be.enabled')
        .click()

      cy.findByLabelText(/Regional analysis name/).type(analysisName)

      cy.findByRole('button', {name: 'Create'}).click()
      // we should now be on the regional analyses page
      cy.findByRole('heading', {name: /Regional Analyses/i, timeout: 10000})
      cy.findByRole('heading', {name: analysisName})
        .parent()
        .parent()
        .as('statusBox')
      // shows progress
      cy.get('@statusBox').findByText(/\d+ \/ \d+ origins/)
      cy.findByRole('heading', {name: analysisName, timeout: 120000}).should(
        'not.exist'
      )
      cy.findByText(/View a regional analysis/)
        .click()
        .type(`${analysisName}{enter}`)
      // now in regional results vieiw
      //cy.findByLabelText(/Export to GIS/i) // TODO dissociated label
      //  .findByRole('button')
      //cy.findByLabelText(/Compare to/i) // TODO dissociated label
      cy.findByText(/Access to/i)
      //cy.findByLabelText(/Aggregate results to/i) // TODO dissociated label
      cy.findByText(/upload new aggregation area/i)
      // clean up
      cy.findByRole('button', {name: 'Delete'}).click()
    })

    it('compares two regional analyses')

    it('uploads an aggregation area')

    it('aggregates results to subregion')
  })
})
