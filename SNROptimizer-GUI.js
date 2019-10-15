// ****************************************************************************
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ****************************************************************************
// SNROptimizer.js
// ****************************************************************************
//
// Copyright (C) 2019 Roberto Sartori. All Rights Reserved.
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (http://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ****************************************************************************

#include "SNROptimizer-GUIParameters.js"

// The script's parameters dialog prototype.
function SNROptimizerDialog() {
    this.__base__ = Dialog;
    this.__base__();

    this.windowTitle = TITLE;

    // ------------------------------------------------------------------------
    // Local vars
    // ------------------------------------------------------------------------
    parameters = new SNROptimizerGUIParameters();
    engine = new SNROptimizerEngine();
    this.parameters = parameters;
    this.engine = engine;

    // ------------------------------------------------------------------------
    // Top Label
    // ------------------------------------------------------------------------
    var titlePane = new Label(this);
    with (titlePane) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        text =
            "<p><b>" + TITLE + " Version " + VERSION + "</b> &mdash; " +
            "This script computes the optimal weights to be assigned to light frames in order " +
            "to maximize the signal to noise ratio of the master integration image. \n" +
            "Optimal weights are stored into the light images with OPT_WEIGHT key to be used during" +
            "the ImageIntegration process.";
    }

    // ------------------------------------------------------------------------
    // Target Images
    // ------------------------------------------------------------------------
    var targetImagesBar = new SectionBar(this, "Target images");
    var targetImagesSection = new Control(targetImagesBar);
    with (targetImagesSection) {

        sizer = new VerticalSizer;
        sizer.spacing = 6;

        // FILE LIST

        var treeBox = new TreeBox(targetImagesSection)
        with (treeBox) {
            setMinHeight = 80;
            multipleSelection = true;
            rootDecoration = false;
            alternateRowColor = true;
            numberOfColumns = 1;
            headerVisible = false;
            setScaledMinSize(200, 200);
            adjustColumnWidthToContents(0);

            onNodeDoubleClicked = function (item, index) {
                console.writeln("index: ", item.text(0));
                let window = ImageWindow.open(item.text(0));
                if (window.length > 0) {
                    window[0].bringToFront()
                }
            }

            setHeaderText(0, "");
            setHeaderAlignment(0, Align_Left | TextAlign_VertCenter);
        }
        sizer.add(treeBox);

        var hsizer = new HorizontalSizer;
        hsizer.spacing = 6;

        // ADD BUTTON

        var filesAddButton = new PushButton(targetImagesSection);
        with (filesAddButton) {
            text = "Add";
            icon = scaledResource(":/icons/add.png");
            toolTip = "<p>Add image files to the input images list.</p>";
            onClick = function () {
                var ofd = new OpenFileDialog;
                ofd.multipleSelections = true;
                ofd.caption = "Select Images";
                ofd.loadImageFilters();

                if (ofd.execute()) {
                    treeBox.canUpdate = false;
                    for (var i = 0; i < ofd.fileNames.length; ++i) {
                        var node = new TreeBoxNode(treeBox);
                        node.setText(0, ofd.fileNames[i]);
                        treeBox.adjustColumnWidthToContents(0);
                        engine.addImage(ofd.fileNames[i]);
                    }
                    treeBox.canUpdate = true;
                }
            };
        }

        // CLEAR BUTTON

        var filesClearButton = new PushButton(targetImagesSection);
        with (filesClearButton) {
            text = "Clear";
            icon = scaledResource(":/icons/clear.png");
            toolTip = "<p>Clear the list of input images.</p>";
            onClick = function () {
                treeBox.clear();
                engine.clearImages();
            };
        }

        hsizer.add(filesAddButton);
        hsizer.add(filesClearButton);
        hsizer.addStretch()
        sizer.add(hsizer);

        adjustToContents();
        setFixedHeight();
    }
    targetImagesBar.setSection(targetImagesSection);


    // ------------------------------------------------------------------------
    // Parameters
    // ------------------------------------------------------------------------
    var parametersBar = new SectionBar(this, "Parameters");
    var parametersSection = new Control(parametersBar);
    with (parametersSection) {
        sizer = new VerticalSizer;
        sizer.spacing = 6;

        // -------------------------------
        // Background reference
        // -------------------------------
        // background preview selector

        var backgroundReferenceLabel = new Label(parametersSection);
        with (backgroundReferenceLabel) {
            margin = 4;
            wordWrapping = true;
            useRichText = true;
            text = "Background reference region:";
        }

        var backgroundPreviewViewList = new ViewList(parametersSection);
        backgroundPreviewViewListNullCurrentView = backgroundPreviewViewList.currentView;

        backgroundPreviewViewList.getPreviews();
        parameters.backgroundPreview = backgroundPreviewViewList.currentView;
        backgroundPreviewViewList.onViewSelected = function (view) {
            for (var i = 0; i < view.window.numberOfPreviews; i++) {
                const preview = view.window.previews[i];
                if (preview.uniqueId === view.uniqueId) {
                    let x = preview.window.previewRect(preview).x0;
                    let y = preview.window.previewRect(preview).y0;
                    engine.setBackgroundROI(x, y, preview.image.width, preview.image.height);
                }
            }
        }

        var hSizer = new HorizontalSizer;
        with (hSizer) {
            add(backgroundReferenceLabel);
            add(backgroundPreviewViewList);
        }
        sizer.add(hSizer);

        // -------------------------------
        // Signal reference
        // -------------------------------

        // signal preview selector
        var signalReferenceLabel = new Label(parametersSection);
        with (signalReferenceLabel) {
            margin = 4;
            wordWrapping = true;
            useRichText = true;
            text = "Signal reference region:";
        }

        var signalPreviewViewList = new ViewList(parametersSection);
        signalPreviewViewListNullCurrentView = signalPreviewViewList.currentView;

        signalPreviewViewList.getPreviews();
        parameters.signalPreview = signalPreviewViewList.currentView;
        signalPreviewViewList.onViewSelected = function (view) {
            for (var i = 0; i < view.window.numberOfPreviews; i++) {
                const preview = view.window.previews[i];
                if (preview.uniqueId === view.uniqueId) {
                    let x = preview.window.previewRect(preview).x0;
                    let y = preview.window.previewRect(preview).y0;
                    engine.setSignalROI(x, y, preview.image.width, preview.image.height);
                }
            }

        }

        hSizer = new HorizontalSizer;
        with (hSizer) {
            add(signalReferenceLabel);
            add(signalPreviewViewList);
        }
        sizer.add(hSizer);

        adjustToContents();
        setFixedHeight();
    }
    parametersBar.setSection(parametersSection);

    // ------------------------------------------------------------------------
    // Dialog buttons
    // ------------------------------------------------------------------------

    var hsizer = new HorizontalSizer;
    hsizer.spacing = 6;

    var executeButton = new PushButton(this);
    executeButton.text = "Execute";
    executeButton.onClick = function () {
        parameters.exit = false;
        this.dialog.ok();
    };
    var cancelButton = new PushButton(this);
    cancelButton.text = "Close";
    cancelButton.onClick = function () {
        parameters.exit = true;
        this.dialog.ok();
    };
    hsizer.add(executeButton);
    hsizer.add(cancelButton);
    hsizer.addStretch();

    // window sizer
    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 6;
        spacing = 6;
        add(titlePane);
        add(targetImagesBar);
        add(targetImagesSection);
        add(parametersBar);
        add(parametersSection);
        add(hsizer);
        addStretch();
    }

    this.setScaledMinWidth(600);
    this.adjustToContents();
    this.setFixedSize();
}
SNROptimizerDialog.prototype = new Dialog;
