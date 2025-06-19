# Contributing to Ring

We're excited that you're interested in contributing to Ring! This document outlines the process for contributing to our project.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```
   git clone https://github.com/connectplatform/ring.git
   cd ring
   ```
3. Install dependencies and setup environment:
   ```
   npm install
   npm run setup:env    # Interactive environment setup
   ```
4. Create a new branch for your feature or bug fix:
   ```
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. Make your changes in the new branch.
2. Follow the coding standards outlined in our [style guide](./docs/STYLE_GUIDE.md).
3. Write tests for your changes.
4. Run the test suite to ensure all tests pass:
   ```
   npm test
   ```
5. Commit your changes:
   ```
   git commit -m "Add a descriptive commit message"
   ```
6. Push to your fork:
   ```
   git push origin feature/your-feature-name
   ```
7. Submit a pull request from your fork to the main Ring repository.

## Pull Request Process

1. Ensure your PR description clearly describes the problem and solution.
2. Include the relevant issue number if applicable.
3. Update the README.md with details of changes to the interface, if applicable.
4. You may merge the Pull Request once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Questions?

If you have any questions, please feel free to contact the project maintainers.

Thank you for your contributions!