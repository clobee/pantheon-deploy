#!/usr/bin/env node

const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const child_process = require('child_process');

const {
    REMOTE_REPO_URL,
    REMOTE_REPO_NAME,
    PANTHEON_MACHINE_TOKEN,
    GITHUB_WORKSPACE,
    HOME
} = process.env;
console.log('GITHUB_WORKSPACE', GITHUB_WORKSPACE);

const pantheonDeploy = (() => {

    const open = ({
        pantheonRepoURL,
        pantheonRepoName,
        machineToken,
        pullRequest
    }) => {
        checkBranch(pullRequest.head.ref, strictBranchName);
        gitBranch(pantheonRepoURL, pullRequest);
        buildMultiDev(machineToken, pantheonRepoName, pullRequest);
    };

    const checkBranch = (prName, strictBranchName) => {
        if (prName.length > 11) {
            core.setFailed("Branch name is too long to create a multidev. Branch names need to be 11 characters or less.");
            process.abort();
        } else if (strictBranchName == "strict" && prName.match(/[A-z]*-[0-9]*/)) {
            core.setFailed("Branch name needs to be Jira friendly (ABC-1234)");
            process.abort();
        } else {
            console.log("\n ✅ Branch name correct.");
        }
    };

    const gitBranch = (pantheonRepoURL, pullRequest) => {
        try {

            console.log("\n 👷 Github initial configuration:");
            child_process.execSync("git config core.sshCommand 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'");
            child_process.execSync('git remote add pantheon ' + pantheonRepoURL);

            console.log("\n Git Remote added:");
            child_process.execSync('git remote -v');
            child_process.execSync('git fetch --unshallow origin');

            console.log("\n Checkout current branch:");
            child_process.execSync('git checkout ' + pullRequest.head.ref);

            console.log("\n Pushing branch to Pantheon:");
            child_process.execSync('git push pantheon ' + pullRequest.head.ref + ':' + pullRequest.head.ref);
            console.log("\n ✅ Branch pushed to Pantheon.");

        } catch (error) {
            core.setFailed(error.message);
            process.abort();
        }
    };

    async function merge(machineToken, pantheonRepoName, pullRequest) {
        try {

            await exec.exec('curl -O https://raw.githubusercontent.com/pantheon-systems/terminus-installer/master/builds/installer.phar');
            await exec.exec('sudo php installer.phar install'); // Sudo is required in order to install bin/terminus.
            await exec.exec('terminus', ['auth:login', `--machine-token=${ machineToken }`]);
            await exec.exec('terminus', ['multidev:merge-to-dev', pantheonRepoName, pullRequest.head.ref]);

        } catch (error) {
            core.setFailed(error.message);
            process.abort();
        }
    }

    async function close(machineToken, pantheonRepoName, pullRequest) {
        try {

            await exec.exec('curl -O https://raw.githubusercontent.com/pantheon-systems/terminus-installer/master/builds/installer.phar');
            await exec.exec('sudo php installer.phar install'); // Sudo is required in order to install bin/terminus.
            await exec.exec('terminus', ['auth:login', `--machine-token=${ machineToken }`]);
            await exec.exec('terminus', ['multidev:delete', pantheonRepoName, pullRequest.head.ref]);

        } catch (error) {
            core.setFailed(error.message);
            process.abort();
        }
    }

    async function buildMultiDev(machineToken, pantheonRepoName, pullRequest) {
        try {

            await exec.exec('curl -O https://raw.githubusercontent.com/pantheon-systems/terminus-installer/master/builds/installer.phar');
            await exec.exec('sudo php installer.phar install'); // Sudo is required in order to install bin/terminus.
            await exec.exec('terminus', ['auth:login', `--machine-token=${ machineToken }`]);
            await exec.exec('terminus', ['multidev:create', pantheonRepoName, pullRequest.head.ref]);

            const output = JSON.stringify(child_process.execSync(`terminus env:view --print ${ pantheonRepoName }.${ pullRequest.head.ref }`));
            console.log('URL to access the multidev is : ' . output);
            core.setOutput('multidev-url', output);
            console.log("\n ✅ Multidev created.");

        } catch (error) {
            core.setFailed(error.message);
            process.abort();
        }
    }
    return {
        open,
        merge,
        close
    }
})();

const validateInputs = (inputs) => {
    const validInputs = inputs.filter(input => {
        if (!input) {
            console.error(`⚠️ ${input} is mandatory`);
        }

        return input;
    });

    if (validInputs.length !== inputs.length) {
        process.abort();
    }
};

const run = () => {
    let prState = core.getInput('PR_STATE');
    switch (prState) {
        case "open":
            pantheonDeploy.open({
                pantheonRepoURL: core.getInput('REMOTE_REPO_URL'),
                pantheonRepoName: core.getInput('REMOTE_REPO_NAME'),
                machineToken: core.getInput('PANTHEON_MACHINE_TOKEN'),
                pullRequest: github.context.payload.pull_request,
                strictBranchName: core.getInput('STRICT_BRANCH_NAMES') || "none",
            });
            break;
        case "merge":
            pantheonDeploy.merge({
                machineToken: core.getInput('PANTHEON_MACHINE_TOKEN'),
                pantheonRepoName: core.getInput('REMOTE_REPO_NAME'),
                pullRequest: github.context.payload.pull_request,
            });
            break;
        case "close":
            pantheonDeploy.close({
                machineToken: core.getInput('PANTHEON_MACHINE_TOKEN'),
                pantheonRepoName: core.getInput('REMOTE_REPO_NAME'),
                pullRequest: github.context.payload.pull_request,
            });
            break;
    }
};

run();