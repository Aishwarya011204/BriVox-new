/**
 * BriVox Web Frontend - Selenium E2E Test Suite
 * File: selenium-tests/tests/login-tests.js
 * 
 * Comprehensive End-to-End Automated Testing for BriVox Authentication & Frontend flows.
 * Compatible with Selenium WebDriver 4.x and Chrome / Firefox / Edge in headless or windowed mode.
 */

import { Builder, By, until, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS !== 'false';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Creates and configures a Selenium WebDriver instance.
 */
export async function createDriver(browser = 'chrome') {
  const chromeOptions = new chrome.Options();
  if (HEADLESS) {
    chromeOptions.addArguments('--headless=new');
  }
  chromeOptions.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,800',
    '--remote-allow-origins=*'
  );

  const firefoxOptions = new firefox.Options();
  if (HEADLESS) {
    firefoxOptions.addArguments('-headless');
  }

  const driver = await new Builder()
    .forBrowser(browser)
    .setChromeOptions(chromeOptions)
    .setFirefoxOptions(firefoxOptions)
    .build();

  await driver.manage().setTimeouts({ implicit: 3000, pageLoad: 15000 });
  return driver;
}

/**
 * Page Object Model (POM) for BriVox Auth Page
 */
export class AuthPage {
  constructor(driver) {
    this.driver = driver;
  }

  // Locators
  locators = {
    authContainer: By.css('.auth'),
    authHero: By.css('.auth-hero'),
    authForm: By.css('.auth-form'),
    heading: By.css('.auth-form h2'),
    subheading: By.css('.auth-form p.muted'),
    googleButton: By.css('.btn.google'),
    emailInput: By.css('input[type="email"]'),
    passwordInput: By.css('.pw input'),
    nameInput: By.css('input[placeholder="Enter your full name"]'),
    passwordToggle: By.css('.pw-toggle'),
    forgotPasswordBtn: By.xpath("//button[contains(text(), 'Forgot password?')]"),
    submitBtn: By.css('.auth-form button.btn.primary'),
    switchModeBtn: By.css('.auth-form .switch button.link'),
    errorAlert: By.css('.alert.error'),
    okAlert: By.css('.alert.ok'),
    previewGauge: By.css('.mini-gauge'),
    features: By.css('.feature'),
    mobileLogo: By.css('.auth-mobile-logo'),
    spinner: By.css('.spinner'),
  };

  async navigate() {
    await this.driver.get(BASE_URL);
    await this.driver.wait(until.elementLocated(this.locators.authContainer), DEFAULT_TIMEOUT_MS);
  }

  async getHeadingText() {
    const el = await this.driver.wait(until.elementLocated(this.locators.heading), DEFAULT_TIMEOUT_MS);
    return await el.getText();
  }

  async enterEmail(email) {
    const el = await this.driver.findElement(this.locators.emailInput);
    await el.clear();
    await el.sendKeys(email);
  }

  async enterPassword(password) {
    const el = await this.driver.findElement(this.locators.passwordInput);
    await el.clear();
    await el.sendKeys(password);
  }

  async enterName(name) {
    const el = await this.driver.wait(until.elementLocated(this.locators.nameInput), DEFAULT_TIMEOUT_MS);
    await el.clear();
    await el.sendKeys(name);
  }

  async clickSubmit() {
    const el = await this.driver.findElement(this.locators.submitBtn);
    await el.click();
  }

  async clickTogglePassword() {
    const el = await this.driver.findElement(this.locators.passwordToggle);
    await el.click();
  }

  async getPasswordInputType() {
    const el = await this.driver.findElement(this.locators.passwordInput);
    return await el.getAttribute('type');
  }

  async clickForgotPassword() {
    const el = await this.driver.findElement(this.locators.forgotPasswordBtn);
    await el.click();
  }

  async switchToSignUp() {
    const heading = await this.getHeadingText();
    if (heading.includes('Sign in')) {
      const el = await this.driver.findElement(this.locators.switchModeBtn);
      await el.click();
      await this.driver.wait(until.elementLocated(this.locators.nameInput), DEFAULT_TIMEOUT_MS);
    }
  }

  async switchToSignIn() {
    const heading = await this.getHeadingText();
    if (heading.includes('Create your account')) {
      const el = await this.driver.findElement(this.locators.switchModeBtn);
      await el.click();
      await this.driver.wait(until.elementLocated(this.locators.forgotPasswordBtn), DEFAULT_TIMEOUT_MS);
    }
  }

  async getErrorMessage() {
    const el = await this.driver.wait(until.elementLocated(this.locators.errorAlert), 5000);
    return await el.getText();
  }

  async getSuccessMessage() {
    const el = await this.driver.wait(until.elementLocated(this.locators.okAlert), 5000);
    return await el.getText();
  }

  async isGoogleButtonVisible() {
    const el = await this.driver.findElement(this.locators.googleButton);
    return await el.isDisplayed();
  }

  async isHeroVisible() {
    const el = await this.driver.findElement(this.locators.authHero);
    return await el.isDisplayed();
  }

  async countFeatures() {
    const elements = await this.driver.findElements(this.locators.features);
    return elements.length;
  }
}

/**
 * Test Runner with structured reporting
 */
export async function runSeleniumTestSuite() {
  console.log(`\n==================================================`);
  console.log(`🚀 Starting BriVox Selenium E2E Web Test Suite`);
  console.log(`Target URL: ${BASE_URL} | Headless: ${HEADLESS}`);
  console.log(`==================================================\n`);

  const results = [];
  let driver;

  const recordResult = (id, name, category, status, durationMs, details = '', error = null) => {
    const res = { id, name, category, status, durationMs, details, error: error ? error.message : null };
    results.push(res);
    const badge = status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`[${badge}] ${id}: ${name} (${durationMs}ms)`);
    if (error) console.error(`       Error: ${error.message}`);
  };

  try {
    driver = await createDriver();
    const authPage = new AuthPage(driver);

    // 1. Page Load & Initial UI Verification
    const t0 = Date.now();
    try {
      await authPage.navigate();
      const heading = await authPage.getHeadingText();
      const heroVisible = await authPage.isHeroVisible();
      const featuresCount = await authPage.countFeatures();

      if (heading.includes('Sign in to your account') && heroVisible && featuresCount === 4) {
        recordResult('TC-SEL-001', 'Initial Auth Page Rendering and Hero Section Check', 'UI/Layout', 'PASS', Date.now() - t0, 'Hero, heading, and 4 feature tiles rendered correctly');
      } else {
        throw new Error(`Unexpected UI state: heading="${heading}", features=${featuresCount}`);
      }
    } catch (err) {
      recordResult('TC-SEL-001', 'Initial Auth Page Rendering and Hero Section Check', 'UI/Layout', 'FAIL', Date.now() - t0, '', err);
    }

    // 2. Google OAuth Button presence
    const t1 = Date.now();
    try {
      const googleVisible = await authPage.isGoogleButtonVisible();
      if (googleVisible) {
        recordResult('TC-SEL-002', 'Google Sign-In Button Presence and Visibility', 'Functional', 'PASS', Date.now() - t1, 'Google SSO button is displayed and interactive');
      } else {
        throw new Error('Google SSO button is not visible');
      }
    } catch (err) {
      recordResult('TC-SEL-002', 'Google Sign-In Button Presence and Visibility', 'Functional', 'FAIL', Date.now() - t1, '', err);
    }

    // 3. Password Visibility Toggle
    const t2 = Date.now();
    try {
      await authPage.enterPassword('SecretPassword123!');
      let typeBefore = await authPage.getPasswordInputType();
      await authPage.clickTogglePassword();
      let typeAfter = await authPage.getPasswordInputType();
      await authPage.clickTogglePassword();
      let typeRestored = await authPage.getPasswordInputType();

      if (typeBefore === 'password' && typeAfter === 'text' && typeRestored === 'password') {
        recordResult('TC-SEL-003', 'Password Visibility Show/Hide Toggle', 'Functional', 'PASS', Date.now() - t2, 'Toggled from password to text and back');
      } else {
        throw new Error(`Toggle failed: before=${typeBefore}, after=${typeAfter}, restored=${typeRestored}`);
      }
    } catch (err) {
      recordResult('TC-SEL-003', 'Password Visibility Show/Hide Toggle', 'Functional', 'FAIL', Date.now() - t2, '', err);
    }

    // 4. Form Validation - Empty Fields
    const t3 = Date.now();
    try {
      await authPage.enterEmail('');
      await authPage.enterPassword('');
      await authPage.clickSubmit();
      // Browser native HTML5 validation stops submission or stays on page
      const heading = await authPage.getHeadingText();
      if (heading.includes('Sign in to your account')) {
        recordResult('TC-SEL-004', 'Client-side HTML5 Required Fields Validation', 'Validation', 'PASS', Date.now() - t3, 'Form submission prevented on empty required inputs');
      } else {
        throw new Error('Form submitted without required fields');
      }
    } catch (err) {
      recordResult('TC-SEL-004', 'Client-side HTML5 Required Fields Validation', 'Validation', 'FAIL', Date.now() - t3, '', err);
    }

    // 5. Invalid Email Format Rejection
    const t4 = Date.now();
    try {
      await authPage.enterEmail('invalid-email-format');
      await authPage.enterPassword('Password123');
      const emailInput = await driver.findElement(authPage.locators.emailInput);
      const isValid = await driver.executeScript('return arguments[0].checkValidity();', emailInput);

      if (!isValid) {
        recordResult('TC-SEL-005', 'Email Format RFC Validation Check', 'Validation', 'PASS', Date.now() - t4, 'HTML5 email validation correctly flagged invalid format');
      } else {
        throw new Error('Invalid email passed validity check');
      }
    } catch (err) {
      recordResult('TC-SEL-005', 'Email Format RFC Validation Check', 'Validation', 'FAIL', Date.now() - t4, '', err);
    }

    // 6. Mode Switch: Sign In -> Sign Up
    const t5 = Date.now();
    try {
      await authPage.switchToSignUp();
      const heading = await authPage.getHeadingText();
      const nameInput = await driver.findElement(authPage.locators.nameInput);
      const isNameVisible = await nameInput.isDisplayed();

      if (heading === 'Create your account' && isNameVisible) {
        recordResult('TC-SEL-006', 'Switch Auth Mode to Sign Up', 'Navigation', 'PASS', Date.now() - t5, 'Mode switched to Sign Up and Full Name field appeared');
      } else {
        throw new Error(`Mode switch failed: heading=${heading}`);
      }
    } catch (err) {
      recordResult('TC-SEL-006', 'Switch Auth Mode to Sign Up', 'Navigation', 'FAIL', Date.now() - t5, '', err);
    }

    // 7. Password Minimum Length Validation in Sign Up
    const t6 = Date.now();
    try {
      await authPage.enterName('Alex Carter');
      await authPage.enterEmail('alex.carter@college.edu');
      await authPage.enterPassword('12345'); // 5 chars, min is 6
      const passwordInput = await driver.findElement(authPage.locators.passwordInput);
      const isValid = await driver.executeScript('return arguments[0].checkValidity();', passwordInput);

      if (!isValid) {
        recordResult('TC-SEL-007', 'Sign Up Password Min Length Enforcement (>=6)', 'Validation', 'PASS', Date.now() - t6, 'HTML5 minLength=6 triggered invalid state for 5-char password');
      } else {
        throw new Error('5-character password passed validity check');
      }
    } catch (err) {
      recordResult('TC-SEL-007', 'Sign Up Password Min Length Enforcement (>=6)', 'Validation', 'FAIL', Date.now() - t6, '', err);
    }

    // 8. Mode Switch: Sign Up -> Sign In
    const t7 = Date.now();
    try {
      await authPage.switchToSignIn();
      const heading = await authPage.getHeadingText();
      if (heading === 'Sign in to your account') {
        recordResult('TC-SEL-008', 'Switch Auth Mode Back to Sign In', 'Navigation', 'PASS', Date.now() - t7, 'Switched back to Sign In mode successfully');
      } else {
        throw new Error(`Unexpected heading: ${heading}`);
      }
    } catch (err) {
      recordResult('TC-SEL-008', 'Switch Auth Mode Back to Sign In', 'Navigation', 'FAIL', Date.now() - t7, '', err);
    }

    // 9. Forgot Password Without Email Prompt
    const t8 = Date.now();
    try {
      await authPage.enterEmail('');
      await authPage.clickForgotPassword();
      const err = await authPage.getErrorMessage();
      if (err.includes('Enter your email address above')) {
        recordResult('TC-SEL-009', 'Forgot Password Missing Email Error Prompt', 'Validation', 'PASS', Date.now() - t8, 'Error correctly displayed: ' + err);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-SEL-009', 'Forgot Password Missing Email Error Prompt', 'Validation', 'FAIL', Date.now() - t8, '', err);
    }

    // 10. Security Input Fuzzing: XSS Script Tag in Email
    const t9 = Date.now();
    try {
      const xssPayload = '<script>alert(1)</script>@test.com';
      await authPage.enterEmail(xssPayload);
      const emailVal = await driver.findElement(authPage.locators.emailInput).getAttribute('value');
      const alerts = await driver.findElements(By.xpath("//script[contains(text(), 'alert(1)')]"));

      if (alerts.length === 0 && emailVal.includes('script')) {
        recordResult('TC-SEL-010', 'Security Fuzzing - XSS Payload In Email Field Escaped', 'Security', 'PASS', Date.now() - t9, 'Payload remained sanitized in DOM attribute without script execution');
      } else {
        throw new Error('Potential script injection or DOM anomaly');
      }
    } catch (err) {
      recordResult('TC-SEL-010', 'Security Fuzzing - XSS Payload In Email Field Escaped', 'Security', 'FAIL', Date.now() - t9, '', err);
    }

    // 11. Security Input Fuzzing: SQL Injection in Password Field
    const t10 = Date.now();
    try {
      const sqliPayload = "' OR '1'='1' -- ";
      await authPage.enterPassword(sqliPayload);
      const pwdVal = await driver.findElement(authPage.locators.passwordInput).getAttribute('value');
      if (pwdVal === sqliPayload) {
        recordResult('TC-SEL-011', 'Security Fuzzing - SQL Injection String Handling', 'Security', 'PASS', Date.now() - t10, 'Special characters handled cleanly without client-side crash');
      } else {
        throw new Error('Password value mutated unexpectedly');
      }
    } catch (err) {
      recordResult('TC-SEL-011', 'Security Fuzzing - SQL Injection String Handling', 'Security', 'FAIL', Date.now() - t10, '', err);
    }

    // 12. Responsive Mobile Viewport Test
    const t11 = Date.now();
    try {
      await driver.manage().window().setRect({ width: 375, height: 667 });
      await driver.sleep(500);
      const mobileLogo = await driver.findElement(authPage.locators.mobileLogo);
      const isMobileLogoDisplayed = await mobileLogo.isDisplayed();

      if (isMobileLogoDisplayed) {
        recordResult('TC-SEL-012', 'Mobile Viewport Breakpoint (375px) Layout Verification', 'Responsive', 'PASS', Date.now() - t11, 'Mobile header logo rendered at 375px width');
      } else {
        throw new Error('Mobile logo was not displayed at 375px');
      }
      // Restore desktop size
      await driver.manage().window().setRect({ width: 1280, height: 800 });
    } catch (err) {
      recordResult('TC-SEL-012', 'Mobile Viewport Breakpoint (375px) Layout Verification', 'Responsive', 'FAIL', Date.now() - t11, '', err);
    }

  } catch (globalErr) {
    console.error('Fatal execution error in Selenium suite:', globalErr);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n==================================================`);
  console.log(`Selenium Suite Finished. Executed: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log(`==================================================\n`);

  return results;
}

// Allow direct CLI invocation: node selenium-tests/tests/login-tests.js
if (process.argv[1] && process.argv[1].endsWith('login-tests.js')) {
  runSeleniumTestSuite().catch(console.error);
}
