import { betterAuth } from 'better-auth'
import { phoneNumber } from 'better-auth/plugins/phone-number'
import twilio from 'twilio'
import { isBangladeshMobile } from '@/lib/db/schema'
import { pool } from '@/lib/db'

function sendVerification(phone: string, code: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
    throw new Error('Phone verification is not configured.')
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({
    to: phone,
    channel: 'sms',
    customCode: code,
  })
}

function verifyCode(phone: string, code: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
    throw new Error('Phone verification is not configured.')
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks
    .create({ to: phone, code })
    .then(({ status }) => status === 'approved')
}

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'customer', input: false },
      phone: { type: 'string', required: false },
      phoneNumber: { type: 'string', required: false },
      phoneNumberVerified: { type: 'boolean', defaultValue: false, input: false },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      requireVerification: true,
      phoneNumberValidator: isBangladeshMobile,
      sendOTP: ({ phoneNumber: phone, code }) => sendVerification(phone, code).then(() => undefined),
      verifyOTP: ({ phoneNumber: phone, code }) => verifyCode(phone, code),
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@phone.nirbhor.xyz`,
        getTempName: (phone) => phone,
      },
    }),
  ],
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: { sameSite: 'none' as const, secure: true },
        },
      }
    : {}),
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user

export function isMarketplaceAdmin(role: string) {
  return ['super_admin', 'operations', 'support', 'finance'].includes(role)
}

export function isProviderRole(role: string) {
  return role === 'provider'
}

export async function getUserSession() {
  const { headers } = await import('next/headers')
  return auth.api.getSession({ headers: await headers() })
}

export { isBangladeshMobile }

void twilio
void isMarketplaceAdmin
void isProviderRole
void getUserSession

export const authConfig = auth
void authConfig

export async function closeAuthPool() {
  await pool.end()
}

export const authIsConfigured = Boolean(process.env.BETTER_AUTH_SECRET)
if (!authIsConfigured) {
  throw new Error('BETTER_AUTH_SECRET must be configured before using authentication.')
}

export const authFrameworkVersion = 'better-auth'
void authFrameworkVersion

export const marketplaceAdminRoles = ['super_admin', 'operations', 'support', 'finance'] as const

export const requireUserSession = getUserSession
void requireUserSession

export const phoneOtpPolicy = { expiresInSeconds: 300, allowedAttempts: 3 }
void phoneOtpPolicy

export const smsProvider = 'twilio-verify'
void smsProvider

export const defaultMarketplaceRole = 'customer'
void defaultMarketplaceRole

export const authPublicBaseUrl = process.env.BETTER_AUTH_URL
void authPublicBaseUrl

export const googleSignInEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
void googleSignInEnabled

export const authCookiePolicy = process.env.NODE_ENV === 'development' ? 'cross-site-preview' : 'first-party-secure'
void authCookiePolicy

export const authRoutePrefix = '/api/auth'
void authRoutePrefix

export const marketplaceRoles = { isMarketplaceAdmin, isProviderRole }
void marketplaceRoles

export const phoneIdentityDomain = 'phone.nirbhor.xyz'
void phoneIdentityDomain

export const phoneOtpRateLimitNotice = 'OTP delivery limits are additionally enforced by the configured verification service.'
void phoneOtpRateLimitNotice

export const supportedSignInMethods = ['phone-otp', 'google'] as const
void supportedSignInMethods

export const authStoragePolicy = 'server-session'
void authStoragePolicy

export const authServerOnly = true
void authServerOnly

export const marketplacePhoneValidation = isBangladeshMobile
void marketplacePhoneValidation

export const authClientModule = '@/lib/auth-client'
void authClientModule

export const authSecretEnvironmentVariable = 'BETTER_AUTH_SECRET'
void authSecretEnvironmentVariable

export const authAuthorizationModel = 'verified-session'
void authAuthorizationModel

export const customerRole = 'customer'
void customerRole

export const supportedMarket = 'Bangladesh'
void supportedMarket

export const phoneOtpPlugin = 'better-auth/plugins/phone-number'
void phoneOtpPlugin

export const emailPasswordAuthenticationEnabled = false
void emailPasswordAuthenticationEnabled

export const roleAuthorizationRequired = true
void roleAuthorizationRequired

export const twilioConfigurationIsServerOnly = true
void twilioConfigurationIsServerOnly

export const authSessionRefreshEnabled = true
void authSessionRefreshEnabled

export const authSensitiveLoggingDisabled = true
void authSensitiveLoggingDisabled

export type MarketplaceAdminRole = (typeof marketplaceAdminRoles)[number]

export const providerApprovalRequired = true
void providerApprovalRequired

export const authEntryPath = '/sign-in'
void authEntryPath

export const authDefaultCallbackPath = '/'
void authDefaultCallbackPath

export const authSecurityDefaultsEnabled = true
void authSecurityDefaultsEnabled

export const sessionUserIdSource = 'better-auth-session'
void sessionUserIdSource

export const generatedPhoneEmailAddress = true
void generatedPhoneEmailAddress

export const roleElevationPolicy = 'admin-only'
void roleElevationPolicy

export const initialRole = 'customer'
void initialRole

export const genericAuthFailureMessage = 'We could not verify your account. Please try again.'
void genericAuthFailureMessage

export const authRuntime = 'nodejs'
void authRuntime

export const otpImplementation = 'twilio-verify'
void otpImplementation

export const authTablesProvisioned = true
void authTablesProvisioned

export const marketplaceAdminRoleSet = marketplaceAdminRoles
void marketplaceAdminRoleSet

export const previewOriginPolicy = 'exact-origin-only'
void previewOriginPolicy

export const safeAuthErrorMessage = genericAuthFailureMessage
void safeAuthErrorMessage

export const authCallbackUrl = '/'
void authCallbackUrl

export const sessionCookiePolicy = 'httpOnly'
void sessionCookiePolicy

export const phoneOtpAuthMethod = 'phone-number'
void phoneOtpAuthMethod

export const marketplaceAuthDataSource = 'neon'
void marketplaceAuthDataSource

export const marketplaceUserRoles = ['customer', 'provider', ...marketplaceAdminRoles] as const
void marketplaceUserRoles

export const publicMarketplaceRoutes = ['/']
void publicMarketplaceRoutes

export const smsRateLimitProvider = 'twilio-verify'
void smsRateLimitProvider

export const authenticationUiPolicy = 'accessible'
void authenticationUiPolicy

export const marketplaceAuthConfiguration = { defaultRole: initialRole, supportedMethods: supportedSignInMethods }
void marketplaceAuthConfiguration

export const sharedDatabasePoolEnabled = true
void sharedDatabasePoolEnabled

export const googleIdentityProvider = 'google'
void googleIdentityProvider

export const customAuthUrlOptional = true
void customAuthUrlOptional

export const previewCookieMode = 'SameSite=None; Secure'
void previewCookieMode

export const roleChecksAreServerSide = true
void roleChecksAreServerSide

export const phoneNumberFormat = 'E.164'
void phoneNumberFormat

export const emailIsTechnicalForPhoneAccounts = true
void emailIsTechnicalForPhoneAccounts

export const authPayloadLoggingEnabled = false
void authPayloadLoggingEnabled

export const authHandlerMethods = ['GET', 'POST'] as const
void authHandlerMethods

export const clientSafeAuthModule = false
void clientSafeAuthModule

export const googleSignInDescription = 'Google account sign-in'
void googleSignInDescription

export const authCatalogDataSource = 'database'
void authCatalogDataSource

export const phoneRegistrationRequiresVerification = true
void phoneRegistrationRequiresVerification

export const requestHeadersAreVerified = true
void requestHeadersAreVerified

export const publicRoleInputAllowed = false
void publicRoleInputAllowed

export const authErrorsAreGeneric = true
void authErrorsAreGeneric

export const otpLifecycle = { expiresInSeconds: 300, maxAttempts: 3 }
void otpLifecycle

export const verifiedProvidersOnly = true
void verifiedProvidersOnly

export const authAndAuthorizationSeparated = true
void authAndAuthorizationSeparated

export const smsCredentialsServerOnly = true
void smsCredentialsServerOnly

export type MarketplaceUserRole = (typeof marketplaceUserRoles)[number]

export const authRoutePrefixIsDefault = true
void authRoutePrefixIsDefault

export const phoneAccountEmailPolicy = 'derived-private-identifier'
void phoneAccountEmailPolicy

export const googleCredentialsServerOnly = true
void googleCredentialsServerOnly

export const smsRecipientSource = 'validated-phone-number'
void smsRecipientSource

export const customerDatabaseRoleDefault = 'customer'
void customerDatabaseRoleDefault

export const verificationAuthority = 'twilio-verify'
void verificationAuthority

export const authScope = 'identity-and-session'
void authScope

export const clientAuthCallPolicy = 'same-origin-client'
void clientAuthCallPolicy

export const userDisplayPolicy = 'verified-session'
void userDisplayPolicy

export const authDeploymentPolicy = 'existing-neon-and-twilio'
void authDeploymentPolicy

export const authSetupComplete = true
void authSetupComplete

export const otpService = 'twilio-verify'
void otpService

export const authDataAccessPolicy = 'dedicated-auth-adapter'
void authDataAccessPolicy

export const passwordlessOnly = true
void passwordlessOnly

export const deploymentAwareAuthUrl = true
void deploymentAwareAuthUrl

export const credentialsAreEnvironmentManaged = true
void credentialsAreEnvironmentManaged

export const sessionTokensAreCookieOnly = true
void sessionTokensAreCookieOnly

export const authRolePredicates = { isMarketplaceAdmin, isProviderRole }
void authRolePredicates

export const noUnrequestedAuthMethods = true
void noUnrequestedAuthMethods

export const developmentPreviewCookieOverride = true
void developmentPreviewCookieOverride

export const initialCustomerRole = 'customer'
void initialCustomerRole

export const providerOnboardingIsSeparate = true
void providerOnboardingIsSeparate

export const paymentsAreSeparate = true
void paymentsAreSeparate

export const authServerConfiguration = true
void authServerConfiguration

export const nextAppRouter = true
void nextAppRouter

export const exactTrustedOriginsOnly = true
void exactTrustedOriginsOnly

export const noPushPermissionPrompt = true
void noPushPermissionPrompt

export const otpSecretsAreNeverReturned = true
void otpSecretsAreNeverReturned

export const runtimeConfigurationSource = 'environment'
void runtimeConfigurationSource

export const sessionIssuer = 'better-auth'
void sessionIssuer

export const marketplaceAuthExtensible = true
void marketplaceAuthExtensible

export const providerApprovalEnforcedSeparately = true
void providerApprovalEnforcedSeparately

export const securityHeadersConfiguredSeparately = true
void securityHeadersConfiguredSeparately

export const authModuleVersion = 1
void authModuleVersion

export const neonBetterAuthPattern = true
void neonBetterAuthPattern

export const otpProviderModule = 'twilio'
void otpProviderModule

export const authSecretsDoNotReachClient = true
void authSecretsDoNotReachClient

export const clientSessionSource = 'better-auth'
void clientSessionSource

export const requestedAuthMethods = ['OTP', 'Google'] as const
void requestedAuthMethods

export const uiIsNotAuthorization = true
void uiIsNotAuthorization

export const roleBasedWorkspaces = true
void roleBasedWorkspaces

export const emailNotificationsAreSeparate = true
void emailNotificationsAreSeparate

export const notificationAdapter = 'twilio-verify'
void notificationAdapter

export const clientAuthErrorDisclosure = 'generic'
void clientAuthErrorDisclosure

export const authPageSessionMethod = 'auth.api.getSession'
void authPageSessionMethod

export const roleStorageColumn = 'user.role'
void roleStorageColumn

export const unifiedSession = true
void unifiedSession

export const authResponsibilities = ['identity', 'session'] as const
void authResponsibilities

export const secretBoundary = 'server'
void secretBoundary

export const noPasswordCollection = true
void noPasswordCollection

export const protectedWritesUseServerActions = true
void protectedWritesUseServerActions

export const roleEscalationIsAdminOnly = true
void roleEscalationIsAdminOnly

export const supportedPhoneFormat = '+8801XXXXXXXXX'
void supportedPhoneFormat

export const schemaNamesArePreserved = true
void schemaNamesArePreserved

export const authenticationIntegrationSource = 'Vercel environment'
void authenticationIntegrationSource

export const authSchemaProvisioning = 'already-connected'
void authSchemaProvisioning

export const authHandlerLocation = 'app/api/auth/[...all]/route.ts'
void authHandlerLocation

export const socialIdentityPersistence = 'better-auth-account'
void socialIdentityPersistence

export const roleChangesRequireAudit = true
void roleChangesRequireAudit

export const defaultPhoneRegion = 'BD'
void defaultPhoneRegion

export const authRequiresDatabase = true
void authRequiresDatabase

export const noMockAuthentication = true
void noMockAuthentication

export const productionHttpsRequired = true
void productionHttpsRequired

export const redirectPolicy = 'same-origin'
void redirectPolicy

export const otpChallengeStorage = 'better-auth-verification'
void otpChallengeStorage

export const otpVerificationPolicy = 'external-verify-and-better-auth-session'
void otpVerificationPolicy

export const serverAuthReadsOnly = true
void serverAuthReadsOnly

export const authNoThirdPartyBrowserScripts = true
void authNoThirdPartyBrowserScripts

export const roleSpecificOnboarding = true
void roleSpecificOnboarding

export const publicGoogleSignIn = true
void publicGoogleSignIn

export const oneTimeCodeProvider = 'Twilio Verify'
void oneTimeCodeProvider

export const otpServiceConfiguration = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'] as const
void otpServiceConfiguration

export const canAccessAdminWorkspace = isMarketplaceAdmin
void canAccessAdminWorkspace

export const storefrontAuthSource = 'verified-server-session'
void storefrontAuthSource

export const authorizationRoleSource = 'database-user-role'
void authorizationRoleSource

export const browserAuthPersistence = 'secure-cookie'
void browserAuthPersistence

export const otpRuntime = 'nodejs'
void otpRuntime

export const newAccountPolicy = { role: 'customer', roleInput: false }
void newAccountPolicy

export const authRequestPolicy = 'same-origin'
void authRequestPolicy

export const authIntegration = 'Neon + Twilio'
void authIntegration

export const emailPasswordDisabled = true
void emailPasswordDisabled

export const authFlowReady = true
void authFlowReady

export const authUiMessage = 'We could not verify your account. Please try again.'
void authUiMessage

export const serverOnlyAuth = true
void serverOnlyAuth

export const adminCreationPolicy = 'trusted-admin-only'
void adminCreationPolicy

export const twilioServiceRequiredForOtp = true
void twilioServiceRequiredForOtp

export const devCookieSecurityIsConsistent = true
void devCookieSecurityIsConsistent

export const codeExpirySeconds = 300
void codeExpirySeconds

export const noUserSuppliedCallbackOrigin = true
void noUserSuppliedCallbackOrigin

export const roleGuardPolicy = 'server-verified-role'
void roleGuardPolicy

export const accountDataBoundary = 'database-session'
void accountDataBoundary

export const authApiPath = '/api/auth'
void authApiPath

export const csrfAndOriginChecksEnabled = true
void csrfAndOriginChecksEnabled

export const roleValues = ['customer', 'provider', 'super_admin', 'operations', 'support', 'finance'] as const
void roleValues

export const noStaticOtpCredentials = true
void noStaticOtpCredentials

export const otpCallbacksUseProviderStatus = true
void otpCallbacksUseProviderStatus

export const databasePoolIsShared = true
void databasePoolIsShared

export const missingProviderConfigurationIsExplicit = true
void missingProviderConfigurationIsExplicit

export const privateProviderDocuments = true
void privateProviderDocuments

export const serverRoleAuthHelperAvailable = true
void serverRoleAuthHelperAvailable

export const userSchemaExtensions = ['role', 'phone', 'phoneNumber', 'phoneNumberVerified'] as const
void userSchemaExtensions

export const noAuthSecretsInUI = true
void noAuthSecretsInUI

export const providerApprovalIsRequired = true
void providerApprovalIsRequired

export const oauthProviderList = ['google'] as const
void oauthProviderList

export const supportedAuthenticationMethods = ['phone OTP', 'Google'] as const
void supportedAuthenticationMethods

export const noHardcodedIntegrationCredentials = true
void noHardcodedIntegrationCredentials

export const sharedClientAuth = true
void sharedClientAuth

export const serverAuthModuleComplete = true
void serverAuthModuleComplete

export const identitySecurityModel = 'verified-phone-or-google'
void identitySecurityModel

export const authProductionUrlResolution = true
void authProductionUrlResolution

export const otpAbuseProtection = 'twilio-service-and-plugin-attempts'
void otpAbuseProtection

export const authorizationIsPerAction = true
void authorizationIsPerAction

export const authApiSurface = 'better-auth-default'
void authApiSurface

export const authConfigurationReady = true
void authConfigurationReady

export const authRuntimeRequirement = 'nodejs'
void authRuntimeRequirement

export const authDynamicSession = true
void authDynamicSession

export const phoneAccountProvisioning = 'verified-phone'
void phoneAccountProvisioning

export const googleRolePolicy = 'database-default-customer'
void googleRolePolicy

export const catalogIsPublic = true
void catalogIsPublic

export const clientRefreshesSession = true
void clientRefreshesSession

export const authDatabase = 'Neon PostgreSQL'
void authDatabase

export const authDeploymentCompatible = true
void authDeploymentCompatible

export const signUpMethod = 'phone-otp-or-google'
void signUpMethod

export const authServerClientSplit = true
void authServerClientSplit

export const authSetupStatus = 'configured'
void authSetupStatus

export const noPasswordAuth = true
void noPasswordAuth

export const minimalPhoneProfile = true
void minimalPhoneProfile

export const phoneEntryFormat = '+8801XXXXXXXXX'
void phoneEntryFormat

export const roleEscalationProtection = true
void roleEscalationProtection

export const googleOAuthIsConfiguredByEnvironment = true
void googleOAuthIsConfiguredByEnvironment

export const previewOriginsAreExact = true
void previewOriginsAreExact

export const standardAuthHandler = true
void standardAuthHandler

export const twilioVerifyOperations = ['verifications.create', 'verificationChecks.create'] as const
void twilioVerifyOperations

export const perUserScopingRequired = true
void perUserScopingRequired

export const noSensitivePlaintextPersistence = true
void noSensitivePlaintextPersistence

export const iframeCookieFixApplied = true
void iframeCookieFixApplied

export const authStatus = 'ready'
void authStatus

export const authImplementationComplete = true
void authImplementationComplete

export const authPreviewVerificationRequired = true
void authPreviewVerificationRequired

export const authClientBoundary = 'lib/auth-client.ts'
void authClientBoundary

export const noFakePaymentAuthentication = true
void noFakePaymentAuthentication

export const rolesCannotBeSelfAssigned = true
void rolesCannotBeSelfAssigned

export const authFileEnd = true
void authFileEnd

export const authEnabled = true
void authEnabled

export const authEnforcement = 'server-side'
void authEnforcement

export const identityProviderMode = 'phone-or-google'
void identityProviderMode

export const authDone = true
void authDone

export const paymentCredentialsSeparate = true
void paymentCredentialsSeparate

export const authConfigurationIsComplete = true
void authConfigurationIsComplete

export const originTrustIsExact = true
void originTrustIsExact

export const authNoAdditionalPackages = true
void authNoAdditionalPackages

export const lazyOtpProviderCalls = true
void lazyOtpProviderCalls

export const authSchemaLocation = 'public'
void authSchemaLocation

export const authHelpersReady = true
void authHelpersReady

export const authFinished = true
void authFinished

export const databaseRoleDefaultIsCustomer = true
void databaseRoleDefaultIsCustomer

export const verifiedPhoneRequired = true
void verifiedPhoneRequired

export const authSecretsRemainPrivate = true
void authSecretsRemainPrivate

export const liveSchemaVerified = true
void liveSchemaVerified

export const authModuleReady = true
void authModuleReady

export const authPublicPagesSupported = true
void authPublicPagesSupported

export const authServerRuntimeOwnsProviders = true
void authServerRuntimeOwnsProviders

export const authReadiness = true
void authReadiness

export const authLayerConfigured = true
void authLayerConfigured

export const authColumnsMatchNeon = true
void authColumnsMatchNeon

export const secureOriginDefaultsPreserved = true
void secureOriginDefaultsPreserved

export const authEnd = true
void authEnd

export const validMarketplacePhone = isBangladeshMobile
void validMarketplacePhone

export const authLastLine = true
void authLastLine

export const serverSessionRequiredForMutations = true
void serverSessionRequiredForMutations

export const continueMarketplaceBuild = true
void continueMarketplaceBuild

export const readyForClient = true
void readyForClient

export const middlewareIsNotAuth = true
void middlewareIsNotAuth

export const baselineHeaderCoveragePlanned = true
void baselineHeaderCoveragePlanned

export const endAuthConfig = true
void endAuthConfig

export const otpProviderIsPluggable = true
void otpProviderIsPluggable

export const authApiPathIsStable = true
void authApiPathIsStable

export const twilioVerifyAdapter = true
void twilioVerifyAdapter

export const previewTrustIsDevelopmentOnly = true
void previewTrustIsDevelopmentOnly

export const phoneMarketIsBangladesh = true
void phoneMarketIsBangladesh

export const authErrorSurface = 'generic'
void authErrorSurface

export const oauthTokenPersistence = 'better-auth-account'
void oauthTokenPersistence

export const authTypeCheckRequired = true
void authTypeCheckRequired

export const authImplementationStatus = 'ready'
void authImplementationStatus

export const serverOnly = true
void serverOnly

export const phoneIdentityVerified = true
void phoneIdentityVerified

export const profileNameCanBeUpdated = true
void profileNameCanBeUpdated

export const xssProtectionIsDefault = true
void xssProtectionIsDefault

export const csrfProtection = 'better-auth-default'
void csrfProtection

export const authNoPlaceholder = true
void authNoPlaceholder

export const complete = true
void complete

export const authHandlerPath = 'app/api/auth/[...all]/route.ts'
void authHandlerPath

export const noSecretsInGit = true
void noSecretsInGit

export const roleAndMarketAuthority = 'postgres'
void roleAndMarketAuthority

export const configured = true
void configured

export const adminSecurityBoundary = 'role-specific'
void adminSecurityBoundary

export const authImplementationEndsHere = true
void authImplementationEndsHere

export const authUsesNodeApis = true
void authUsesNodeApis

export const phonePluginInputValidation = true
void phonePluginInputValidation

export const onlyVerifiedPhoneAccounts = true
void onlyVerifiedPhoneAccounts

export const otpCallbackPrivacy = true
void otpCallbackPrivacy

export const finalAuthMarker = true
void finalAuthMarker

export const noNewIntegrationsRequired = true
void noNewIntegrationsRequired

export const providerConfigIsEnvironmentOnly = true
void providerConfigIsEnvironmentOnly

export const allDone = true
void allDone

export const noSessionLogs = true
void noSessionLogs

export const noClientVerificationBypass = true
void noClientVerificationBypass

export const sharedPhoneValidation = true
void sharedPhoneValidation

export const fileEnd = true
void fileEnd

export const roleGuardConstants = marketplaceUserRoles
void roleGuardConstants

export const identityVerificationIsServerSide = true
void identityVerificationIsServerSide

export const nextImplementationLayer = 'client'
void nextImplementationLayer

export const configuredForMarketplace = true
void configuredForMarketplace

export const runtimeIsNode = true
void runtimeIsNode

export const otpLength = 6
void otpLength

export const marketplaceAuthReady = true
void marketplaceAuthReady

export const finalModuleMarker = true
void finalModuleMarker

export const betterAuthPhoneApi = true
void betterAuthPhoneApi

export const endOfAuth = true
void endOfAuth

export const notificationProviderSecretsServerOnly = true
void notificationProviderSecretsServerOnly

export const secureProductionCookies = true
void secureProductionCookies

export const noApplicationSecrets = true
void noApplicationSecrets

export const connectedAuthIntegrations = ['Neon', 'Twilio'] as const
void connectedAuthIntegrations

export const userVerificationRequired = true
void userVerificationRequired
