/* Existing test data migrated from test.js. */
export const TESTS = {

    /* =====================================================
       REAL ANALYSIS
       ===================================================== */

    "real-analysis": {

        title: "Real Analysis",

        lectures: {

            /* =================================================
               LECTURE 1
               ================================================= */

            "1": {

                title: "Lecture 1",

                tests: {

                    /* ==============================
                       TEST 1
                       ============================== */

                    "1": {

                        title:
                            "Real Analysis - Lecture 1 Test - 1",

                        duration: 15,

                        questions: [

                            {
                                question:
                                    "Which of the following statements is true about every convergent sequence?",

                                options: [

                                    {
                                        text:
                                            "Every convergent sequence is bounded",

                                        correct: true,

                                        solution:
                                            "Every convergent sequence is bounded."
                                    },

                                    {
                                        text:
                                            "Every bounded sequence is convergent",

                                        correct: false,

                                        solution:
                                            "A bounded sequence need not converge. For example, (-1)^n is bounded but divergent."
                                    },

                                    {
                                        text:
                                            "Every sequence is convergent",

                                        correct: false,

                                        solution:
                                            "Not every sequence converges."
                                    },

                                    {
                                        text:
                                            "Every divergent sequence is bounded",

                                        correct: false,

                                        solution:
                                            "A divergent sequence can be bounded or unbounded."
                                    }

                                ]
                            },


                            {
                                question:
                                    "If a sequence converges to L, what is its limit?",

                                options: [

                                    {
                                        text: "L",

                                        correct: true,

                                        solution:
                                            "By definition, the limit of the sequence is L."
                                    },

                                    {
                                        text: "0 always",

                                        correct: false,

                                        solution:
                                            "A convergent sequence need not converge to zero."
                                    },

                                    {
                                        text: "Infinity always",

                                        correct: false,

                                        solution:
                                            "A convergent sequence has a finite real limit."
                                    },

                                    {
                                        text: "It has no limit",

                                        correct: false,

                                        solution:
                                            "A convergent sequence necessarily has a limit."
                                    }

                                ]
                            },


                            {
                                question:
                                    "Which condition is sufficient for a sequence to be Cauchy in R?",

                                options: [

                                    {
                                        text:
                                            "The sequence is convergent",

                                        correct: true,

                                        solution:
                                            "Every convergent sequence in R is Cauchy."
                                    },

                                    {
                                        text:
                                            "The sequence contains only positive terms",

                                        correct: false,

                                        solution:
                                            "Positive terms alone do not imply the Cauchy property."
                                    },

                                    {
                                        text:
                                            "The sequence is always increasing",

                                        correct: false,

                                        solution:
                                            "An increasing sequence need not be Cauchy."
                                    },

                                    {
                                        text:
                                            "The sequence has infinitely many terms",

                                        correct: false,

                                        solution:
                                            "Having infinitely many terms does not imply that a sequence is Cauchy."
                                    }

                                ]
                            },


                            {
                                question:
                                    "What is the supremum of the set (0,1)?",

                                options: [

                                    {
                                        text: "1",

                                        correct: true,

                                        solution:
                                            "The supremum of (0,1) is 1."
                                    },

                                    {
                                        text: "0",

                                        correct: false,

                                        solution:
                                            "0 is the infimum, not the supremum."
                                    },

                                    {
                                        text: "1/2",

                                        correct: false,

                                        solution:
                                            "1/2 is not an upper bound of (0,1)."
                                    },

                                    {
                                        text:
                                            "There is no supremum",

                                        correct: false,

                                        solution:
                                            "The set (0,1) has supremum 1."
                                    }

                                ]
                            },


                            {
                                question:
                                    "Which theorem states that every bounded monotone sequence converges?",

                                options: [

                                    {
                                        text:
                                            "Monotone Convergence Theorem",

                                        correct: true,

                                        solution:
                                            "Every bounded monotone sequence of real numbers converges."
                                    },

                                    {
                                        text:
                                            "Intermediate Value Theorem",

                                        correct: false,

                                        solution:
                                            "This theorem concerns continuous functions."
                                    },

                                    {
                                        text:
                                            "Bolzano-Weierstrass Theorem",

                                        correct: false,

                                        solution:
                                            "It states that every bounded sequence has a convergent subsequence."
                                    },

                                    {
                                        text:
                                            "Mean Value Theorem",

                                        correct: false,

                                        solution:
                                            "It concerns derivatives of functions."
                                    }

                                ]
                            }

                        ]

                    },


                    /* ==============================
                       TEST 2
                       ============================== */

                    "2": {

                        title:
                            "Real Analysis - Lecture 1 Test - 2",

                        duration: 30,

                        questions: [

                            {
                                question:
                                    "Which of the following sequences converges to 0?",

                                options: [

                                    {
                                        text: "1/n",

                                        correct: true,

                                        solution:
                                            "As n tends to infinity, 1/n tends to 0."
                                    },

                                    {
                                        text: "n",

                                        correct: false,

                                        solution:
                                            "n tends to infinity."
                                    },

                                    {
                                        text: "(-1)^n",

                                        correct: false,

                                        solution:
                                            "(-1)^n oscillates between -1 and 1."
                                    },

                                    {
                                        text: "n^2",

                                        correct: false,

                                        solution:
                                            "n^2 tends to infinity."
                                    }

                                ]
                            },


                            {
                                question:
                                    "Which of the following sequences is bounded?",

                                options: [

                                    {
                                        text: "(-1)^n",

                                        correct: true,

                                        solution:
                                            "The sequence only takes the values -1 and 1."
                                    },

                                    {
                                        text: "n",

                                        correct: false,

                                        solution:
                                            "n is unbounded."
                                    },

                                    {
                                        text: "n^2",

                                        correct: false,

                                        solution:
                                            "n^2 is unbounded."
                                    },

                                    {
                                        text: "2^n",

                                        correct: false,

                                        solution:
                                            "2^n is unbounded."
                                    }

                                ]
                            },


                            {
                                question:
                                    "What is the infimum of the set (0,1)?",

                                options: [

                                    {
                                        text: "0",

                                        correct: true,

                                        solution:
                                            "The infimum of (0,1) is 0."
                                    },

                                    {
                                        text: "1",

                                        correct: false,

                                        solution:
                                            "1 is the supremum."
                                    },

                                    {
                                        text: "1/2",

                                        correct: false,

                                        solution:
                                            "1/2 is not a lower bound."
                                    },

                                    {
                                        text:
                                            "There is no infimum",

                                        correct: false,

                                        solution:
                                            "The set (0,1) has infimum 0."
                                    }

                                ]
                            },


                            {
                                question:
                                    "Which of the following is true for every convergent sequence of real numbers?",

                                options: [

                                    {
                                        text: "It is bounded",

                                        correct: true,

                                        solution:
                                            "Every convergent sequence of real numbers is bounded."
                                    },

                                    {
                                        text:
                                            "It is strictly increasing",

                                        correct: false,

                                        solution:
                                            "Convergence does not imply increasing behaviour."
                                    },

                                    {
                                        text:
                                            "It is strictly decreasing",

                                        correct: false,

                                        solution:
                                            "Convergence does not imply decreasing behaviour."
                                    },

                                    {
                                        text:
                                            "It contains only positive terms",

                                        correct: false,

                                        solution:
                                            "A convergent sequence may contain negative terms."
                                    }

                                ]
                            },


                            {
                                question:
                                    "Which sequence is monotone increasing?",

                                options: [

                                    {
                                        text: "a_n = n",

                                        correct: true,

                                        solution:
                                            "a_(n+1) = n+1 > n = a_n."
                                    },

                                    {
                                        text: "a_n = (-1)^n",

                                        correct: false,

                                        solution:
                                            "The sequence alternates between -1 and 1."
                                    },

                                    {
                                        text: "a_n = 1/n",

                                        correct: false,

                                        solution:
                                            "1/n is decreasing."
                                    },

                                    {
                                        text: "a_n = (-1)^n/n",

                                        correct: false,

                                        solution:
                                            "The signs alternate."
                                    }

                                ]
                            }

                        ]

                    },


                    /* ==============================
                       TEST 3
                       ============================== */

                    "3": {

                        title:
                            "Real Analysis - Lecture 1 Test - 3",

                        duration: 30,

                        questions: [

                            {
                                question:
                                    "Which of the following is an example of a divergent sequence?",

                                options: [

                                    {
                                        text: "(-1)^n",

                                        correct: true,

                                        solution:
                                            "The sequence oscillates between -1 and 1 and therefore does not converge."
                                    },

                                    {
                                        text: "1/n",

                                        correct: false,

                                        solution:
                                            "1/n converges to 0."
                                    },

                                    {
                                        text: "1",

                                        correct: false,

                                        solution:
                                            "The constant sequence 1 converges to 1."
                                    },

                                    {
                                        text: "1/(n+1)",

                                        correct: false,

                                        solution:
                                            "1/(n+1) converges to 0."
                                    }

                                ]
                            }

                        ]

                    }

                }

            },


            /* =================================================
               LECTURE 2
               ================================================= */

            "2": {

                title: "Lecture 2",

                tests: {

                    "1": {

                        title:
                            "Real Analysis - Lecture 2 Test - 1",

                        duration: 30,

                        questions: [

                            {
                                question:
                                    "A sample Lecture 2 question?",

                                options: [

                                    {
                                        text: "Correct Answer",

                                        correct: true,

                                        solution:
                                            "This is the correct answer."
                                    },

                                    {
                                        text: "Wrong Answer",

                                        correct: false,

                                        solution:
                                            "This is incorrect."
                                    },

                                    {
                                        text: "Wrong Answer",

                                        correct: false,

                                        solution:
                                            "This is incorrect."
                                    },

                                    {
                                        text: "Wrong Answer",

                                        correct: false,

                                        solution:
                                            "This is incorrect."
                                    }

                                ]
                            }

                        ]

                    },


                    "2": {

                        title:
                            "Real Analysis - Lecture 2 Test - 2",

                        duration: 30,

                        questions: []

                    }

                }

            },


            /* =================================================
               LECTURE 3
               ================================================= */

            "3": {

                title: "Lecture 3",

                tests: {

                    "1": {

                        title:
                            "Real Analysis - Lecture 3 Test - 1",

                        duration: 30,

                        questions: []

                    },

                    "2": {

                        title:
                            "Real Analysis - Lecture 3 Test - 2",

                        duration: 30,

                        questions: []

                    }

                }

            }

        }

    },


    /* =====================================================
       CALCULUS
       ===================================================== */

    "calculus": {

        title: "Calculus",

        lectures: {

            /* =================================================
               LECTURE 1
               ================================================= */

            "1": {

                title: "Calculus - Lecture 1",

                tests: {

                    "1": {

                        title:
                            "Calculus - Lecture 1 Test - 1",

                        duration: 30,

                        questions: [

                            {
                                question:
                                    "What is the derivative of x²?",

                                options: [

                                    {
                                        text: "2x",

                                        correct: true,

                                        solution:
                                            "Using the power rule, d(x²)/dx = 2x."
                                    },

                                    {
                                        text: "x",

                                        correct: false,

                                        solution:
                                            "The derivative of x² is 2x."
                                    },

                                    {
                                        text: "x²",

                                        correct: false,

                                        solution:
                                            "x² is the original function, not its derivative."
                                    },

                                    {
                                        text: "2",

                                        correct: false,

                                        solution:
                                            "The derivative of x² is 2x."
                                    }

                                ]
                            }

                        ]

                    },


                    "2": {

                        title:
                            "Calculus - Lecture 1 Test - 2",

                        duration: 30,

                        questions: []

                    },


                    "3": {

                        title:
                            "Calculus - Lecture 1 Test - 3",

                        duration: 30,

                        questions: []

                    }

                }

            },


            /* =================================================
               LECTURE 2
               ================================================= */

            "2": {

                title: "Calculus - Lecture 2",

                tests: {

                    "1": {

                        title:
                            "Calculus - Lecture 2 Test - 1",

                        duration: 30,

                        questions: []

                    },

                    "2": {

                        title:
                            "Calculus - Lecture 2 Test - 2",

                        duration: 30,

                        questions: []

                    }

                }

            },


            /* =================================================
               LECTURE 3
               ================================================= */

            "3": {

                title: "Calculus - Lecture 3",

                tests: {

                    "1": {

                        title:
                            "Calculus - Lecture 3 Test - 1",

                        duration: 30,

                        questions: []

                    },

                    "2": {

                        title:
                            "Calculus - Lecture 3 Test - 2",

                        duration: 30,

                        questions: []

                    }

                }

            }

        }

    }

};
