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

#define TITLE "SNROptimizer"
#define VERSION "1.0"

#feature-id Utilities > SNROptimizer

#feature-info Signal-to-noise optimizer.< br />\
    <br />\
    This script computes the optimal weights to be assigned to light frames in order\
    to maximize the signal to noise ratio of the master integration image.\
    <br />\
    Copyright & copy; 2019 Roberto Sartori.All Rights Reserved.

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/SectionBar.jsh>
#include "SNROptimizer-Engine.js"
#include "SNROptimizer-GUI.js"

function main() {
    console.hide();
    
    if (Parameters.isGlobalTarget) {
        // Script has been launched in global context, execute and exit
        var engine = new SNROptimizerEngine();
        engine.loadParameters();
        engine.execute();
        return;
    }

    // Prepare the dialog
    var parametersDialog = new SNROptimizerDialog();
    parametersDialog.parameters.exit = false;

    // Runloop
    while (!parametersDialog.parameters.exit) {
        
        if (Parameters.isViewTarget && !parameters.targetView) {
            // A target is already defined, init it as the target view
            parametersDialog.parameters.targetView = this.targetView;
            parametersDialog.parameters.getParameters();
        }
        else {
            // Dialog needs to be opened in order to select the image and set parameters
            // Use the current active view as target by default
            parametersDialog.parameters.targetView = ImageWindow.activeWindow.currentView;            
        }

        // Run the dialog
        if (!parametersDialog.execute()) {
            // Dialog closure forced
            return;
        }

        // do the job
        if (!parametersDialog.parameters.exit) {
            console.show();
            parametersDialog.engine.execute();
            console.hide();
        }
    }
}

main();

// ****************************************************************************
// EOF CorrectMagentaStars.js
