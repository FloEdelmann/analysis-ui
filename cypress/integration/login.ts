// Warning: this does not work properly still.
// Cypress has problems with navigating between domains.
describe.skip('Login Command', () => {
  beforeEach(() => {
    cy.clearCookie('a0:state')
    cy.clearCookie('a0:session')
  })

  it('should log the user in behind the scenes and set the cookie', () => {
    cy.login()

    cy.contains(Cypress.env('username'))
    cy.contains(Cypress.env('accessGroup'))
  })

  describe('cookie persists', () => {
    // Following tests must be run together
    it('should login', () => {
      cy.login()
    })

    it('should persist the cookie between tests', () => {
      cy.visit('/')
      cy.getCookie('a0:session').should('exist')
    })
  })

  it('should log out the user and no longer be able to access the site', () => {
    cy.login()
    cy.findByText(/Log out/).click()

    cy.findByText(Cypress.env('username')).should('not.exist')
    cy.findByText(Cypress.env('accessGroup')).should('not.exist')
    cy.getCookie('a0:session').should('not.exist')
  })
})
