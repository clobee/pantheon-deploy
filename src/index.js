#!/usr/bin/env node

const core = require('@actions/core');
const exec = require('@actions/exec');
const child_process = require('child_process');

const successItems = ["🦾", "✅", "👍", "😎", "🤓", "😊", "🎉", "🔥", "👷", "🏄"]
const errorItems = ["🙀", "⭕", "🥶", "😵", "💣", "🧨", " 🤷", "⛔", "❌", "🆘"]

const reservedBranchNames = ["settings", "master", "team", "support", "debug", "multidev", "files", "tags", "billing"]

const pantheon = (() => {

    const init = ({
        action,
        branchName,
        siteId,
        repoURL,
        strictBranchName
    }) => {
        switch (action) {
            case "create-multidev":
                hasTerminus();
                isBranchNameValid(branchName, strictBranchName);
                branchPush(repoURL, branchName);
                createMultiDev(siteId, branchName);
                break;
            case "merge-to-dev":
                hasTerminus();
                isBranchNameValid(branchName, strictBranchName);
                branchPush(repoURL, branchName);
                mergeToDev(siteId, branchName);
                break;
            case "delete-multidev":
                hasTerminus();
                deleteMultiDev(siteId, branchName);
                break;
            default:
                customLog('error', `️️️Unknown action: ${action}`);
                process.abort();
                break;
        }
    }

    const branchPush = (remoteUrl, branchName) => {
        try {
            child_process.execSync("git config core.sshCommand 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'");
            child_process.execSync(`git remote add pantheon ${remoteUrl}`);

            child_process.execSync('git remote -v');
            child_process.execSync('git fetch --unshallow origin');

            child_process.execSync(`git checkout ${branchName}`);
            child_process.execSync(`git push pantheon ${branchName}:${branchName}`);
        } catch (error) {
            customLog('error', error.message);
            process.abort();
        }
    }

    const isBranchNameValid = (branchName, strictBranchName) => {
        if (branchName.length > 11) {
            customLog('error', `Branch name ${branchName} is too long to create a multidev. Branch names need to be 11 characters or less. 🗣️`);
            process.abort();
        } else if ("strict" === strictBranchName && !branchName.match(/[a-z]*[0-9]*?[0-9]/)) {
            customLog('error', `Branch name ${branchName} needs to be Jira friendly (abc-1234)`);
            process.abort();
        } else if (reservedBranchNames.includes(branchName)) {
            customLog('error', `Branch name "${branchName}" is a reserved name`);
            process.abort();
        }

        customLog('check-branch', `Branch name ${branchName} is correct`);
    }

    customLog = (outputName, string) => {
        let output = JSON.stringify(string);

        if ('error' == outputName) {
            let randItem = errorItems[Math.floor(Math.random() * errorItems.length)]
            core.setFailed(randItem + " " + output);
            process.abort();
        }

        let randItem = successItems[Math.floor(Math.random() * successItems.length)]
        console.log(randItem + " " + outputName, output);
    }

    async function hasTerminus() {
        try {
            await exec.exec('terminus -V');
            customLog('setup-terminus', 'Terminus is set and ready to go');
        } catch (error) {
            customLog('error', 'Terminus is missing');
            process.abort();
        }
    }

    async function mergeToDev(remoteName, branchName) {
        try {
            await exec.exec(`terminus multidev:merge-to-dev ${remoteName}.${branchName} -y`);

            customLog('merge-multidev', `${branchName} has been merged`);
            core.setOutput('multidev', `${branchName} has been merged`);
        } catch (error) {
            customLog('error', error.message);
            process.abort();
        }
    }

    async function deleteMultiDev(remoteName, branchName) {
        try {
            await exec.exec(`terminus multidev:delete ${remoteName}.${branchName} -y`);

            customLog('delete-multidev', `${branchName} has been deleted`);
            core.setOutput('multidev', `${branchName} has been deleted`);
        } catch (error) {
            customLog('error', error.message);
            process.abort();
        }
    }

    async function createMultiDev(remoteName, branchName) {
        try {
            await exec.exec(`terminus multidev:create ${remoteName} ${branchName}`);

            let multidevUrl = child_process.execSync(`terminus env:view --print ${remoteName}.${branchName }`);

            customLog('create-multidev', `${branchName} has been created`);
            core.setOutput('multidev', `${multidevUrl} has been created`);
        } catch (error) {
            customLog('error', error.message);
            process.abort();
        }
    }

    return {
        init
    }
})();

const run = () => {
    pantheon.init({
        action: core.getInput('ACTION'),
        branchName: core.getInput('BRANCH_NAME'),
        siteId: core.getInput('PANTHEON_SITE_ID'),
        repoURL: core.getInput('PANTHEON_REPO_URL'),
        strictBranchName: core.getInput('STRICT_BRANCH_NAME')
    });
};

run();