// ==UserScript==
// @name         CivitAI prompt compare
// @namespace    https://github.com/FarisHijazi
// @description  Frontend mod to show (diff)erence between prompts in civitai.com/generate
// @author       Faris Hijazi
// @version      0.2
// @icon         https://www.google.com/s2/favicons?domain=https://civitai.com/
// @match        https://civitai.com/*
// @include      https://civitai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @grant        window.close
// @grant        window.focus
// @run-at       document-end
// @require      http://incaseofstairs.com/jsdiff/diff.js
// @noframes
// @connect      *
// ==/UserScript==

/* Utility function to escape HTML to prevent XSS attacks */
function escapeHtml(html) {
    var text = document.createTextNode(html);
    var p = document.createElement("p");
    p.appendChild(text);
    return p.innerHTML;
}

function highlightDifferences(oldText, newText) {
    const diff = Diff.diffWords(oldText, newText);
    let highlightedText = "";

    diff.forEach((part) => {
        /* Softer darker colors for additions and deletions, nothing for unchanged parts */
        const color = part.added ? "lightgreen" : part.removed ? "lightcoral" : "transparent";
        const span = `<span style="background-color:${color};${
            part.removed ? "text-decoration: line-through;" : ""
        }">${escapeHtml(part.value)}</span>`;
        highlightedText += span;
    });

    return highlightedText;
}

let getPromptDivs = () =>
    document.querySelectorAll(
        "div > div.mantine-Stack-root.mantine-73946b > div.mantine-Spoiler-root.mantine-a2c69m > div > div > div"
    );

function showDiff() {
    /* reset Diffs every time */
    getPromptDivs().forEach(function removeDiffsFromDiv(divElement) {
        if (divElement.originalInnerHTML) {
            divElement.innerHTML = divElement.originalInnerHTML;
        }
    });

    /* get all divs again */
    let promptDivs = getPromptDivs();
    if (!promptDivs.length) {
        console.warn("No promptDivs found");
        return;
    } else {
        console.log("showDiff()");
    }

    let referenceDiv = document.querySelector(".referencePrompt");

    if (referenceDiv === null) {
        /* implicit referenceDiv */
        referenceDiv = promptDivs[0];

        /* save class so that we can reference it later */
        referenceDiv.classList.add("referencePrompt");
        console.log("the referenceDiv:", referenceDiv);

        let referenceIndex = Array.from(promptDivs).findIndex((div) => div.classList.contains("referencePrompt"));
        if (referenceIndex === -1) {
            referenceIndex = 0;
            console.warn("referenceIndex not found, setting to 0, although it should be this:", referenceDiv);
        }

        for (let i = referenceIndex + 1; i < promptDivs.length; i++) {
            let oldText = promptDivs[i - 1].innerText;
            if (!promptDivs[i - 1].originalInnerHTML) promptDivs[i - 1].originalInnerHTML = promptDivs[i - 1].innerHTML;
            let newText = promptDivs[i].innerText;
            if (!promptDivs[i].originalInnerHTML) promptDivs[i].originalInnerHTML = promptDivs[i].innerHTML;

            promptDivs[i].innerHTML = highlightDifferences(oldText, newText);
        }
        for (let i = referenceIndex - 1; i >= 0; i--) {
            let oldText = promptDivs[i + 1].innerText;
            if (!promptDivs[i + 1].originalInnerHTML) promptDivs[i + 1].originalInnerHTML = promptDivs[i + 1].innerHTML;
            let newText = promptDivs[i].innerText;
            if (!promptDivs[i].originalInnerHTML) promptDivs[i].originalInnerHTML = promptDivs[i].innerHTML;

            promptDivs[i].innerHTML = highlightDifferences(oldText, newText);
        }
    } else {
        let oldText = referenceDiv.innerText;
        /* explicit from button press */
        for (let i = 0; i < promptDivs.length; i++) {
            let newText = promptDivs[i].innerText;
            if (!promptDivs[i].originalInnerHTML) promptDivs[i].originalInnerHTML = promptDivs[i].innerHTML;

            promptDivs[i].innerHTML = highlightDifferences(oldText, newText);
        }
    }
}
function init() {
    /* when automated, return back to automated */
    document.querySelectorAll(".referencePrompt").forEach((div) => div.classList.remove("referencePrompt"));
    let promptDivs = getPromptDivs();

    let showMoreButtons = [...promptDivs].map((div) => div.parentElement.parentElement.nextElementSibling);
    if (showMoreButtons.length)
        showMoreButtons.filter((div) => div && div.innerText === "Show More").forEach((div) => div.click());

    for (const promptDiv of promptDivs) {
        let showMoreButton = promptDiv.parentElement.parentElement.nextElementSibling;
        if (!showMoreButton) {
            console.warn("showMoreButton not found");
            continue;
        }
        if (promptDiv.parentElement.parentElement.parentElement.querySelector(".focusThisButton")) continue;
        const focusThisButton = showMoreButton.cloneNode();
        focusThisButton.innerText = "Diff Reference";
        focusThisButton.classList.add("focusThisButton");
        focusThisButton.addEventListener("click", (event) => {
            event.stopPropagation(); /* Prevent the click event from propagating to the showMoreButton */
            document.querySelectorAll(".referencePrompt").forEach((div) => div.classList.remove("referencePrompt"));
            const newPromptDiv = focusThisButton.parentElement.querySelector("div.mantine-Text-root.mantine-syw07n");
            newPromptDiv.classList.add("referencePrompt");
            console.log("clicked focusThisButton", newPromptDiv, focusThisButton);
            showDiff();

            /* TODO: when pressed, change button to become a different mode: progressive diffing, which will reset all buttons to normal, and will delete all classlist .referencePrompt */
        });
        showMoreButton.after(focusThisButton);
        focusThisButton.style.marginLeft = "10px";
        showMoreButton.style.marginRight = "10px";
    }
}

/* TODO: automatic init and update on new divs */

function observeDocument(callback) {
    callback(document.body);
    new MutationObserver(function (mutations, me) {
        me.disconnect();
        for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length) {
                callback(mutations[i].target);
                break;
            }
        }
        me.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
        });
    }).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
    });
}

(function () {
    if (typeof Diff === "undefined") {
        console.error("Diff is not defined");
        return;
    }

    /* Add CSS stylesheet for .referencePrompt selector */
    let styleEl = document.createElement("style");
    styleEl.innerHTML = `
    .referencePrompt {
        background-color: rgba(255, 255, 0, 0.3);
    }
`;
    document.head.appendChild(styleEl);

    // if (!location.href.startsWith("https://civitai.com/generate")) {
    //     console.warn("This script only runs on civitai.com/generate");
    //     return;
    // }

    console.log("hello civitai.com/generate");
    init();
    showDiff();
    observeDocument(function (target) {
        if (target.matches("div.mantine-a2c69m")) {
            init();
            showDiff();
        }
    });
})();
