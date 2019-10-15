// ****************************************************************************
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ****************************************************************************
// SNROptimizer-Engine.js
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

#define BACKGROUND_INT_ID       "backgroundIntegration"
#define SIGNAL_INT_ID           "signalIntegration"

#define BACKGROUND_DELTA_ID     "backgroundIntegration_delta"
#define SIGNAL_DELTA_ID         "signalIntegration_delta"

#define FIT_WEIGHT_KEY          "SNROPT_WEIGHT"
#define DELTA                   0.0001
#define SPEED                   1024.0
#define MAX_SPEED_REDUCTIONS    12
#define GRAD_TOLERANCE          0.001
#define SNR_INCREMENT_TOLERANCE 0.001
#define MAX_ITERATIONS          100

function EngineParametersPrototype() {
    // -------------------------------------
    // Engine parameters
    // -------------------------------------
    this.inputFiles = [];
    this.backgroundROI = { x: 0, y: 0, w: 0, h: 0 };
    this.signalROI = { x: 0, y: 0, w: 0, h: 0 };

    this.reset = function (){
        this.backgroundPreviews = [];
        this.signalPreviews = [];
    }
}
var ep = new EngineParametersPrototype();

// The script's process prototype.
function SNROptimizerEngine() {

    // -------------------------------------
    // Initialize PixelMath instance
    // -------------------------------------
    this.initializeCalculusTools = function () {
        var PM = new PixelMath;
        PM.expression1 = "";
        PM.expression2 = "";
        PM.expression3 = "";
        PM.useSingleExpression = true;
        PM.symbols = "";
        PM.generateOutput = true;
        PM.singleThreaded = false;
        PM.use64BitWorkingImage = false;
        PM.rescale = false;
        PM.rescaleLower = 0;
        PM.rescaleUpper = 1;
        PM.truncate = true;
        PM.truncateLower = 0;
        PM.truncateUpper = 1;
        PM.createNewImage = true;
        PM.showNewImage = false;
        PM.newImageWidth = 0;
        PM.newImageHeight = 0;
        PM.newImageAlpha = false;
        PM.newImageColorSpace = PixelMath.prototype.SameAsTarget;
        PM.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
        this.PM = PM;
    }

    this.doMath = function (expression, target, newImageId) {
        this.PM.expression = expression;
        this.PM.newImageId = newImageId;
        this.PM.executeOn(target, false);
    }

    this.crop = function (view, ROI) {
        var P = new DynamicCrop;
        P.centerX = (ROI.x + ROI.w / 2) / view.image.width;
        P.centerY = (ROI.y + ROI.h / 2) / view.image.height;
        P.width = ROI.w / view.image.width;
        P.height = ROI.h / view.image.height;
        P.angle = 0.0000;
        P.scaleX = 1.00000;
        P.scaleY = 1.00000;
        P.optimizeFast = true;
        P.interpolation = DynamicCrop.prototype.Auto;
        P.clampingThreshold = 0.30;
        P.smoothness = 1.50;
        P.xResolution = 72.000;
        P.yResolution = 72.000;
        P.metric = false;
        P.forceResolution = false;
        P.red = 0.000000;
        P.green = 0.000000;
        P.blue = 0.000000;
        P.alpha = 1.000000;
        P.noGUIMessages = false;

        P.executeOn(view, false);
    }

    this.toGray = function(imageView) {
        var P = new ChannelExtraction;
        P.colorSpace = ChannelExtraction.prototype.HSI;
        P.channels = [ // enabled, id
            [false, ""],
            [false, ""],
            [true, ""]
        ];
        P.sampleFormat = ChannelExtraction.prototype.SameAsSource;
        P.executeOn(imageView, false);
    }

    // -------------------------------------
    // Image management
    // -------------------------------------

    this.loadPreviews = function () {
        ep.reset();
        ep.inputFiles.forEach(imagePath => {
            let bckID = "background_" + ep.backgroundPreviews.length;
            let sigID = "signal_" + ep.signalPreviews.length;
            console.writeln("Load image ", bckID);
            var backgroundWindows = ImageWindow.open(imagePath, bckID);
            console.writeln("Load image ", sigID);
            var signalWindows = ImageWindow.open(imagePath, sigID);

            if (backgroundWindows.length == 0 || signalWindows.length == 0) {
                console.warning("Failed to load ", imagePath);
            } else {
                let backgroundView = backgroundWindows[0].mainView;
                let signalView = signalWindows[0].mainView;
                this.crop(backgroundView, ep.backgroundROI);
                this.crop(signalView, ep.signalROI);

                // convert go gray scale if needed
                if (backgroundView.image.numberOfChannels > 1) {
                    this.toGray(backgroundView);
                }
                if (signalView.image.numberOfChannels > 1) {
                    this.toGray(signalView);
                }

                ep.backgroundPreviews.push(backgroundView);
                ep.signalPreviews.push(signalView);

                backgroundView.id = bckID;
                signalView.id = sigID;
            }
        });
    }

    this.closeImage = function (id) {
        var w = ImageWindow.windowById(id);
        if (!w.isNull) {
            w.close();
        }
    }

    // -------------------------------------
    //            SOLVER FUNCTIONS
    // -------------------------------------

    this.initializeSolver = function () {
        // initialize solution
        ep.state = [];
        ep.error = false;
        ep.errorMsg = "";
        for (var i = 0; i < ep.backgroundPreviews.length; i++) {
            ep.state.push(1.0);
        }
        ep.costData = this.computeCostFunction(ep.state);
    }

    this.computeCostFunction = function (state) {
        this.closeImage(BACKGROUND_INT_ID);
        this.closeImage(SIGNAL_INT_ID);
        this.integrate(ep.backgroundPreviews, state, BACKGROUND_INT_ID);
        this.integrate(ep.signalPreviews, state, SIGNAL_INT_ID);
        let costFunction = this.costFunctionFromImages(BACKGROUND_INT_ID, SIGNAL_INT_ID);
        return costFunction;
    }

    this.integrate = function (images, state, imageId) {
        var expression = "";
        var add = "";
        images.forEach((view, index) => {
            expression += add + state[index] + "/" + images.length + "*" + view.id;
            add = "+";
        });
        // expression += ")/" + images.length;
        console.writeln("Integrate background with expression: ", expression);
        this.doMath(expression, images[0], imageId);
    }

    this.costFunctionFromImages = function (bckID, signalID) {
        const bckImg = ImageWindow.windowById(bckID).mainView.image;
        const signalImg = ImageWindow.windowById(signalID).mainView.image;
        let bckMedian = bckImg.median();
        let bckNoise = bckImg.stdDev();
        let signalMedian = signalImg.median();
        let SNR = (signalMedian - bckMedian) / bckNoise;
        // TEMP: save partial data to log on console
        return {
            cost: 1 / SNR,
            SNR: SNR,
            std: bckNoise,
            median: signalMean
        };
    }

    this.computeGradient = function (costFunctionValue, state, delta) {
        var gradient = [];
        var maxGradient = 0;
        state.forEach((_, i) => {
            // compute only the delta given by the current state coeff
            // (I * N - x0*P + x1*P)/N = I + (x1-x0)/N*P = I + delta/N*P
            // INTEGRATION + delta / N * PREVIEW(i)
            var expression = "" + BACKGROUND_INT_ID + "+" + delta + "/" + state.length + "*" + ep.backgroundPreviews[i].id;
            this.doMath(expression, ep.backgroundPreviews[0], BACKGROUND_DELTA_ID);
            expression = "" + SIGNAL_INT_ID + "+" + delta + "/" + state.length + "*" + ep.signalPreviews[i].id;
            this.doMath(expression, ep.signalPreviews[0], SIGNAL_DELTA_ID);
            let newCost = this.costFunctionFromImages(BACKGROUND_DELTA_ID, SIGNAL_DELTA_ID).cost;
            gradient[i] = (newCost - costFunctionValue) / delta;
            this.closeImage(BACKGROUND_DELTA_ID);
            this.closeImage(SIGNAL_DELTA_ID);
            
            if (isNaN(gradient[i])) {
                ep.error = true;
                ep.errorMsg = "gradient at index " + i + " is NaN.";
            } else {
                maxGradient = Math.max(maxGradient, Math.abs(gradient[i]));
            }
        })
        ep.maxGradient = maxGradient;
        return gradient;
    }

    this.computeNewState = function (state, gradient, speed) {
        var newState = [];
        state.forEach((x, i) => {
            newState[i] = Math.max(0.01, x - speed * gradient[i]);
        });
        return newState;
    }

    this.executeOptimization = function () {
        var iteration = 0;
        var unableToMakeImprovements = false;
        var speed = SPEED;
        var speedReductionsCount = 0;
        while (true) {
            iteration += 1;
            let state = ep.state;
            let prevCostData = {
                cost: ep.costData.cost,
                SNR: ep.costData.SNR,
                median: ep.costData.median,
                std: ep.costData.std,
            };
            var newCostData;
            let gradient = this.computeGradient(prevCostData.cost, state, DELTA);
            console.writeln("Gradient:");
            gradient.forEach((x, i) => {
                console.writeln("[", i, "]: ", x);
            })
            // iterate until an improvement is achived, if not reduce the increment.
            // limit iterations to 10
            
            while (true) {
                if (ep.error) {
                    console.writeln("Iteration [", iteration, "] FAILED");
                    console.writeln("  ", ep.err.errorMsg);
                    break;
                }
                
                if (speedReductionsCount >= MAX_SPEED_REDUCTIONS) {
                    unableToMakeImprovements = true;
                    break;
                }

                var newState = this.computeNewState(state, gradient, speed);
                newCostData = this.computeCostFunction(newState);
                if (newCostData.SNR - prevCostData.SNR <= 0) {
                    // step didn't increase SNR, reduce the step
                    speedReductionsCount += 1;
                    speed = speed / 2;
                    console.writeln("");
                    console.writeln("Reduce speed to ", speed);
                    console.writeln("");
                } else {
                    // save progression
                    ep.state = newState;
                    ep.costData = newCostData;
                    break;
                }
            }

            console.writeln("Iteration [", iteration, "]");
            console.writeln("  SNR          : ", ep.costData.SNR);
            console.writeln("  SNR prev     : ", prevCostData.SNR);
            console.writeln("  SNR increment: ", ep.costData.SNR - prevCostData.SNR);
            console.writeln("  MEdian       : ", newCostData.median * 65535);
            console.writeln("  std          : ", newCostData.std * 65535);
            console.writeln("  max gradient : ", ep.maxGradient);
            console.writeln("  speed        : ", speed);
            console.writeln(" ");
            console.writeln(" STATE: ");
            ep.state.forEach((x, i) => {
                console.writeln("[", i, "]: ", x);
            });
            console.writeln(" ");

            let SNRToleranceCheck = Math.abs(newCostData.SNR - prevCostData.SNR) < SNR_INCREMENT_TOLERANCE;
            // let SNRToleranceCheck = Math.abs(1 / ep.costFunctionValue - 1 / prevCostFunctionValue) < SNR_TOLERANCE;
            let gradientToleranceCheck = ep.maxGradient < GRAD_TOLERANCE;
            if (SNRToleranceCheck && gradientToleranceCheck) {
                console.writeln("SNR tolerance reached");
                break;
            }

            if (unableToMakeImprovements) {
                console.writeln("Unable to make further improvements, maximum reached");
                break;
            }

            if (iteration >= MAX_ITERATIONS) {
                console.writeln("Max iterations reached, stop");
                break;
            }
        }

        console.writeln("OPTIMAL VALUES FOUD: ");
        ep.state.forEach((x, i) => {
            console.writeln("[", i, "]: ", x);
        })
    }

    this.closeAll = function() {
        this.closeImage(BACKGROUND_INT_ID);
        this.closeImage(BACKGROUND_DELTA_ID);
        this.closeImage(SIGNAL_INT_ID);
        this.closeImage(SIGNAL_DELTA_ID);
        ep.backgroundPreviews.forEach(view => {
            view.window.close();
        });
        ep.signalPreviews.forEach(view => {
            view.window.close();
        });
    }

    this.recordWeights = function () {
        ep.inputFiles.forEach((filepath, i) => {
            let imageWindows = ImageWindow.open(filepath);
            let imageWindow = imageWindows[0];

            var filteredKeywords = [];
            var keywords = imageWindow.keywords;
            for (var j = 0; j != keywords.length; ++j) {
                var keyword = keywords[j];
                if (keyword.name != FIT_WEIGHT_KEY) {
                    filteredKeywords.push(keyword);
                }
            }
            imageWindow.keywords = filteredKeywords.concat([
                new FITSKeyword(
                    FIT_WEIGHT_KEY,
                    format("%.5e", ep.state[i]).replace("e", "E"),
                    "SNROptimizer weight"
                )
            ]);
            this.writeImage(filepath, imageWindow, true, "");
            imageWindow.close();
        });
    }

    this.writeImage = function(filePath, imageWindow, ieeefpSampleFormat, hints) {
        var extension = File.extractExtension(filePath);

        var fileFormat = new FileFormat(extension, false, true);
        if (fileFormat.isNull) {
            return null;
        }

        var fileFormatInstance = new FileFormatInstance(fileFormat);
        if (fileFormatInstance.isNull) {
            return null;
        }

        if (!fileFormatInstance.create(filePath, hints)) {
            return null;
        }

        var description = new ImageDescription;
        description.bitsPerSample = ieeefpSampleFormat ? 32 : 8;
        description.ieeefpSampleFormat = ieeefpSampleFormat;
        if (!fileFormatInstance.setOptions(description)) {
            fileFormatInstance.close();
            return null;
        }

        
        fileFormatInstance.keywords = imageWindow.keywords;
        if (!fileFormatInstance.writeImage(imageWindow.mainView.image)) {
            return null;
        }

        fileFormatInstance.close();
    }

    // -------------------------------------
    // Execute and management function
    // -------------------------------------

    this.setBackgroundROI = function(x, y, w, h) {
        ep.backgroundROI.x = x;
        ep.backgroundROI.y = y;
        ep.backgroundROI.w = w;
        ep.backgroundROI.h = h;
    }

    this.setSignalROI = function (x, y, w, h) {
        ep.signalROI.x = x;
        ep.signalROI.y = y;
        ep.signalROI.w = w;
        ep.signalROI.h = h;
    }
    
    this.addImage = function (image) {
        ep.inputFiles.push(image);
    }

    this.clearImages = function () {
        ep.inputFiles = [];
    }

    this.execute = function () {
        // store parameters
        this.initializeCalculusTools();
        this.loadPreviews();
        this.initializeSolver();
        this.executeOptimization();
        this.closeAll();
        if (!ep.error) {
            this.recordWeights();
        }
    }
}