// Authored floor anchors, foreground clips and local effect masks.
// Coordinates are normalized to the 1536 × 1024 empty scene plates.
export const DETAIL_ROOMS = {
  'dream-garden': {
    room: 1,
    name: 'Dream Garden',
    subtitle: 'A little less certain. A little more curious.',
    treatment:
      'Lilac paths and living glaze. Mushroom caps slowly refract and change their sheen while spores rise and curious creatures wander in loose curves.',
    zones: [
      {
        key: 'upper-tea-clearing',
        cx: 0.282,
        cy: 0.263,
        rx: 0.061,
        ry: 0.031,
        capacity: 14,
        layout: 'scatter',
        motion: 'dream'
      },
      {
        key: 'teacup-clearing',
        cx: 0.647,
        cy: 0.259,
        rx: 0.062,
        ry: 0.024,
        capacity: 12,
        layout: 'scatter',
        motion: 'dream'
      },
      {
        key: 'tree-clearing',
        cx: 0.867,
        cy: 0.392,
        rx: 0.08,
        ry: 0.039,
        capacity: 18,
        layout: 'scatter',
        motion: 'dream'
      },
      {
        key: 'left-meander',
        cx: 0.202,
        cy: 0.494,
        rx: 0.08,
        ry: 0.059,
        capacity: 18,
        layout: 'scatter',
        motion: 'dream'
      },
      {
        key: 'lower-meander',
        cx: 0.381,
        cy: 0.722,
        rx: 0.072,
        ry: 0.07,
        capacity: 16,
        layout: 'scatter',
        motion: 'dream'
      },
      {
        key: 'mushroom-clearing',
        cx: 0.719,
        cy: 0.724,
        rx: 0.089,
        ry: 0.052,
        capacity: 22,
        layout: 'scatter',
        motion: 'dream'
      }
    ],
    rims: [
      [
        [0.18, 0.285],
        [0.235, 0.311],
        [0.292, 0.305],
        [0.337, 0.28],
        [0.344, 0.296],
        [0.299, 0.325],
        [0.236, 0.332],
        [0.186, 0.308]
      ],
      [
        [0.668, 0.791],
        [0.744, 0.813],
        [0.802, 0.817],
        [0.84, 0.805],
        [0.85, 0.825],
        [0.8, 0.851],
        [0.745, 0.846],
        [0.675, 0.824]
      ]
    ],
    lights: [],
    vibe: {
      glaze: [
        {
          polygon: [
            [0.092, 0.137],
            [0.113, 0.105],
            [0.159, 0.066],
            [0.187, 0.023],
            [0.21, 0.032],
            [0.226, 0.079],
            [0.257, 0.109],
            [0.26, 0.132],
            [0.226, 0.14],
            [0.182, 0.119],
            [0.14, 0.127],
            [0.112, 0.144]
          ],
          strength: 1,
          tint: '#b5e8dd'
        },
        {
          polygon: [
            [0.055, 0.31],
            [0.066, 0.283],
            [0.09, 0.256],
            [0.116, 0.252],
            [0.139, 0.274],
            [0.152, 0.309],
            [0.143, 0.328],
            [0.115, 0.311],
            [0.089, 0.313],
            [0.069, 0.329]
          ],
          strength: 0.9,
          tint: '#d4b7f5'
        },
        {
          polygon: [
            [0.814, 0.576],
            [0.842, 0.537],
            [0.868, 0.5],
            [0.891, 0.51],
            [0.918, 0.548],
            [0.923, 0.574],
            [0.899, 0.584],
            [0.87, 0.569],
            [0.841, 0.594],
            [0.814, 0.591]
          ],
          strength: 1,
          tint: '#bcead4'
        },
        {
          polygon: [
            [0.891, 0.644],
            [0.914, 0.614],
            [0.944, 0.607],
            [0.963, 0.625],
            [0.972, 0.651],
            [0.96, 0.662],
            [0.938, 0.649],
            [0.914, 0.669]
          ],
          strength: 0.85,
          tint: '#efb9e8'
        }
      ],
      spores: [
        {
          x: 0.2,
          y: 0.25,
          rx: 0.12,
          ry: 0.15,
          count: 8,
          color: '#edcff1'
        },
        {
          x: 0.863,
          y: 0.626,
          rx: 0.08,
          ry: 0.14,
          count: 8,
          color: '#e2eed3'
        },
        {
          x: 0.681,
          y: 0.387,
          rx: 0.13,
          ry: 0.14,
          count: 8,
          color: '#d4bdf2'
        }
      ]
    }
  },
  'quiet-house': {
    room: 2,
    name: 'Quiet House',
    subtitle: 'Nothing needs you right now.',
    treatment:
      'Porcelain and moonlight. A linen curtain stirs; dust drifts through the light. The little beings take slow strolls, pausing for a moment before wandering on.',
    zones: [
      {
        key: 'upper-linen-niche',
        cx: 0.484,
        cy: 0.23,
        rx: 0.059,
        ry: 0.019,
        capacity: 14,
        layout: 'scatter',
        motion: 'quiet'
      },
      {
        key: 'right-linen-niche',
        cx: 0.863,
        cy: 0.383,
        rx: 0.051,
        ry: 0.022,
        capacity: 14,
        layout: 'scatter',
        motion: 'quiet'
      },
      {
        key: 'lower-left-niche',
        cx: 0.159,
        cy: 0.706,
        rx: 0.077,
        ry: 0.03,
        capacity: 16,
        layout: 'scatter',
        motion: 'quiet'
      },
      {
        key: 'lower-right-niche',
        cx: 0.78,
        cy: 0.815,
        rx: 0.095,
        ry: 0.033,
        capacity: 20,
        layout: 'scatter',
        motion: 'quiet'
      },
      {
        key: 'moonlit-floor',
        cx: 0.484,
        cy: 0.519,
        rx: 0.238,
        ry: 0.164,
        capacity: 36,
        layout: 'scatter',
        motion: 'quiet'
      }
    ],
    rims: [
      [
        [0.076, 0.739],
        [0.12, 0.759],
        [0.181, 0.767],
        [0.234, 0.744],
        [0.252, 0.724],
        [0.251, 0.755],
        [0.21, 0.782],
        [0.136, 0.794],
        [0.082, 0.771]
      ],
      [
        [0.646, 0.854],
        [0.704, 0.874],
        [0.776, 0.883],
        [0.858, 0.857],
        [0.894, 0.84],
        [0.906, 0.868],
        [0.852, 0.902],
        [0.767, 0.922],
        [0.69, 0.909],
        [0.639, 0.881]
      ]
    ],
    lights: [],
    vibe: {
      beams: [
        {
          polygon: [
            [0.232, 0.275],
            [0.282, 0.292],
            [0.528, 0.575],
            [0.35, 0.522]
          ],
          from: [0.245, 0.285],
          to: [0.445, 0.545],
          color: '#e6e4ff',
          opacity: 0.14
        }
      ],
      curtains: [
        {
          polygon: [
            [0.182, 0.03],
            [0.207, 0.027],
            [0.213, 0.144],
            [0.217, 0.241],
            [0.245, 0.313],
            [0.267, 0.316],
            [0.235, 0.347],
            [0.188, 0.344],
            [0.176, 0.281],
            [0.174, 0.139]
          ],
          amplitude: 0.0018
        }
      ],
      motes: [
        {
          x: 0.347,
          y: 0.41,
          rx: 0.081,
          ry: 0.115,
          count: 20,
          color: '#f1edff'
        },
        {
          x: 0.208,
          y: 0.2,
          rx: 0.018,
          ry: 0.1,
          count: 6,
          color: '#e8e1f7'
        }
      ]
    }
  },
  source: {
    room: 3,
    name: 'The Source',
    subtitle: 'Again. Softer. Again.',
    treatment:
      'A lovingly strange pleasure apparatus. Light travels through coiled conduits; ceramic bodies catch a passing gloss, and the slow ritual repeats.',
    zones: [
      {
        key: 'rear-receiving-pad',
        cx: 0.5449,
        cy: 0.251,
        rx: 0.0332,
        ry: 0.0127,
        capacity: 8,
        layout: 'scatter',
        motion: 'source'
      },
      {
        key: 'left-receiving-pad',
        cx: 0.1738,
        cy: 0.3936,
        rx: 0.0521,
        ry: 0.0205,
        capacity: 14,
        layout: 'scatter',
        motion: 'source'
      },
      {
        key: 'right-receiving-pad',
        cx: 0.7767,
        cy: 0.3301,
        rx: 0.0508,
        ry: 0.0186,
        capacity: 16,
        layout: 'scatter',
        motion: 'source'
      },
      {
        key: 'front-left-receiving-pad',
        cx: 0.2786,
        cy: 0.6543,
        rx: 0.0475,
        ry: 0.0254,
        capacity: 18,
        layout: 'scatter',
        motion: 'source'
      },
      {
        key: 'front-right-receiving-pad',
        cx: 0.7461,
        cy: 0.6533,
        rx: 0.0566,
        ry: 0.0283,
        capacity: 18,
        layout: 'scatter',
        motion: 'source'
      },
      {
        key: 'central-receiving-floor',
        cx: 0.501,
        cy: 0.49,
        rx: 0.19,
        ry: 0.16,
        capacity: 26,
        layout: 'scatter',
        motion: 'source'
      }
    ],
    rims: [
      [
        [0.104, 0.42],
        [0.153, 0.44],
        [0.2, 0.431],
        [0.241, 0.414],
        [0.248, 0.433],
        [0.211, 0.458],
        [0.164, 0.469],
        [0.116, 0.453]
      ],
      [
        [0.208, 0.676],
        [0.254, 0.703],
        [0.295, 0.697],
        [0.34, 0.671],
        [0.352, 0.686],
        [0.319, 0.714],
        [0.271, 0.735],
        [0.222, 0.719]
      ],
      [
        [0.68, 0.678],
        [0.737, 0.704],
        [0.787, 0.69],
        [0.814, 0.674],
        [0.828, 0.697],
        [0.787, 0.721],
        [0.737, 0.736],
        [0.682, 0.709]
      ]
    ],
    lights: [],
    vibe: {
      flows: [
        {
          points: [
            [0.2292, 0.1963],
            [0.2598, 0.1738],
            [0.2467, 0.2334],
            [0.2663, 0.2451]
          ],
          count: 3,
          seconds: 9,
          color: '#ffe1f2'
        },
        {
          points: [
            [0.3848, 0.2021],
            [0.4206, 0.1934],
            [0.3939, 0.2725],
            [0.4603, 0.2412]
          ],
          count: 3,
          seconds: 10,
          color: '#ffc5e9'
        },
        {
          points: [
            [0.6243, 0.2627],
            [0.653, 0.2529],
            [0.6816, 0.2646],
            [0.6888, 0.2891]
          ],
          count: 3,
          seconds: 11,
          color: '#f9c7ec'
        },
        {
          points: [
            [0.2923, 0.2822],
            [0.252, 0.2822],
            [0.2949, 0.3164],
            [0.2591, 0.3438]
          ],
          count: 3,
          seconds: 12,
          color: '#f4c9fb'
        },
        {
          points: [
            [0.3737, 0.6191],
            [0.4512, 0.6875],
            [0.3314, 0.7344],
            [0.2897, 0.7461]
          ],
          count: 4,
          seconds: 16,
          color: '#ffd5ed'
        },
        {
          points: [
            [0.6367, 0.6172],
            [0.5658, 0.6602],
            [0.6543, 0.7334],
            [0.7096, 0.7393]
          ],
          count: 4,
          seconds: 17,
          color: '#ffd5ed'
        }
      ]
    }
  },
  'open-studio': {
    room: 4,
    name: 'Open Studio',
    subtitle: 'Make something without a brief.',
    treatment:
      'Buttercream clay, cobalt pigment, and permission to make a mess. Wet brush marks unfurl across three work surfaces while curious makers dab, inspect, and wander.',
    zones: [
      {
        key: 'shelf-aisle',
        cx: 0.348,
        cy: 0.257,
        rx: 0.106,
        ry: 0.039,
        capacity: 12,
        layout: 'scatter',
        motion: 'studio'
      },
      {
        key: 'glaze-aisle',
        cx: 0.617,
        cy: 0.392,
        rx: 0.115,
        ry: 0.066,
        capacity: 18,
        layout: 'scatter',
        motion: 'studio'
      },
      {
        key: 'left-work-floor',
        cx: 0.33,
        cy: 0.609,
        rx: 0.129,
        ry: 0.07,
        capacity: 20,
        layout: 'scatter',
        motion: 'studio'
      },
      {
        key: 'middle-work-floor',
        cx: 0.576,
        cy: 0.562,
        rx: 0.118,
        ry: 0.084,
        capacity: 24,
        layout: 'scatter',
        motion: 'studio'
      },
      {
        key: 'front-work-floor',
        cx: 0.488,
        cy: 0.746,
        rx: 0.11,
        ry: 0.072,
        capacity: 16,
        layout: 'scatter',
        motion: 'studio'
      },
      {
        key: 'drying-gallery',
        cx: 0.808,
        cy: 0.834,
        rx: 0.108,
        ry: 0.039,
        capacity: 10,
        layout: 'scatter',
        motion: 'studio'
      }
    ],
    rims: [
      [
        [0.001, 0.665],
        [0.095, 0.726],
        [0.173, 0.794],
        [0.314, 0.894],
        [0.299, 0.995],
        [0, 1]
      ],
      [
        [0.409, 0.876],
        [0.462, 0.857],
        [0.535, 0.914],
        [0.642, 0.99],
        [0.58, 1],
        [0.408, 1]
      ]
    ],
    lights: [],
    vibe: {
      paint: [
        {
          polygon: [
            [0.2, 0.347],
            [0.297, 0.32],
            [0.342, 0.363],
            [0.242, 0.392]
          ],
          seconds: 23,
          strokes: [
            {
              points: [
                [0.219, 0.352],
                [0.246, 0.329],
                [0.267, 0.377],
                [0.303, 0.35]
              ],
              color: '#4b76c3',
              width: 0.006
            },
            {
              points: [
                [0.236, 0.369],
                [0.252, 0.36],
                [0.271, 0.344],
                [0.308, 0.365]
              ],
              color: '#d77a66',
              width: 0.004
            },
            {
              points: [
                [0.257, 0.347],
                [0.272, 0.334],
                [0.283, 0.352],
                [0.295, 0.339]
              ],
              color: '#6caba5',
              width: 0.004
            }
          ]
        },
        {
          polygon: [
            [0.597, 0.19],
            [0.654, 0.177],
            [0.709, 0.197],
            [0.673, 0.224]
          ],
          seconds: 29,
          strokes: [
            {
              points: [
                [0.618, 0.194],
                [0.627, 0.175],
                [0.65, 0.218],
                [0.688, 0.197]
              ],
              color: '#609c94',
              width: 0.004
            },
            {
              points: [
                [0.626, 0.202],
                [0.648, 0.215],
                [0.663, 0.194],
                [0.684, 0.206]
              ],
              color: '#507cb2',
              width: 0.004
            },
            {
              points: [
                [0.642, 0.19],
                [0.659, 0.183],
                [0.661, 0.214],
                [0.681, 0.2]
              ],
              color: '#d89b5d',
              width: 0.003
            }
          ]
        },
        {
          polygon: [
            [0.728, 0.577],
            [0.828, 0.546],
            [0.879, 0.604],
            [0.776, 0.642]
          ],
          seconds: 31,
          strokes: [
            {
              points: [
                [0.75, 0.586],
                [0.823, 0.64],
                [0.776, 0.526],
                [0.849, 0.59]
              ],
              color: '#577dc0',
              width: 0.008
            },
            {
              points: [
                [0.767, 0.609],
                [0.818, 0.58],
                [0.822, 0.643],
                [0.859, 0.605]
              ],
              color: '#d88186',
              width: 0.006
            },
            {
              points: [
                [0.776, 0.579],
                [0.799, 0.61],
                [0.845, 0.562],
                [0.85, 0.595]
              ],
              color: '#79a78b',
              width: 0.004
            }
          ]
        }
      ],
      mobiles: [],
      flecks: [
        {
          x: 0.26,
          y: 0.38,
          rx: 0.07,
          ry: 0.12,
          count: 6,
          color: '#cc936b'
        },
        {
          x: 0.65,
          y: 0.26,
          rx: 0.08,
          ry: 0.11,
          count: 6,
          color: '#77a6ab'
        },
        {
          x: 0.8,
          y: 0.61,
          rx: 0.08,
          ry: 0.11,
          count: 8,
          color: '#b6a0c8'
        }
      ]
    }
  },
  hearth: {
    room: 5,
    name: 'The Hearth',
    subtitle: 'No agenda. Just good company.',
    treatment:
      'Low ember light, wine-red blankets, and small circles of company. A living flame warms the clay; sparks rise while the little beings shuffle, lean, and make room.',
    zones: [
      {
        key: 'high-story-floor',
        cx: 0.255,
        cy: 0.275,
        rx: 0.123,
        ry: 0.064,
        capacity: 14,
        layout: 'scatter',
        motion: 'hearth'
      },
      {
        key: 'rear-blanket-circle',
        cx: 0.526,
        cy: 0.312,
        rx: 0.147,
        ry: 0.045,
        capacity: 16,
        layout: 'scatter',
        motion: 'hearth'
      },
      {
        key: 'right-tea-floor',
        cx: 0.797,
        cy: 0.436,
        rx: 0.106,
        ry: 0.068,
        capacity: 14,
        layout: 'scatter',
        motion: 'hearth'
      },
      {
        key: 'left-fire-circle',
        cx: 0.203,
        cy: 0.51,
        rx: 0.096,
        ry: 0.056,
        capacity: 16,
        layout: 'scatter',
        motion: 'hearth'
      },
      {
        key: 'front-fire-circle',
        cx: 0.474,
        cy: 0.659,
        rx: 0.16,
        ry: 0.068,
        capacity: 24,
        layout: 'scatter',
        motion: 'hearth'
      },
      {
        key: 'lower-blanket-circle',
        cx: 0.813,
        cy: 0.825,
        rx: 0.092,
        ry: 0.035,
        capacity: 16,
        layout: 'scatter',
        motion: 'hearth'
      }
    ],
    rims: [
      [
        [0.617, 0.533],
        [0.649, 0.56],
        [0.745, 0.537],
        [0.798, 0.555],
        [0.811, 0.592],
        [0.727, 0.623],
        [0.661, 0.622],
        [0.615, 0.576]
      ],
      [
        [0.575, 0.757],
        [0.635, 0.789],
        [0.733, 0.849],
        [0.836, 0.879],
        [0.952, 0.84],
        [0.972, 0.889],
        [0.898, 0.936],
        [0.817, 0.948],
        [0.7, 0.909],
        [0.607, 0.84],
        [0.555, 0.792]
      ],
      [
        [0.065, 0.691],
        [0.126, 0.726],
        [0.217, 0.766],
        [0.228, 0.786],
        [0.19, 0.786],
        [0.1, 0.757],
        [0.023, 0.727]
      ]
    ],
    lights: [],
    vibe: {
      fire: {
        x: 0.456,
        y: 0.496,
        rx: 0.04,
        ry: 0.135,
        color: '#ffae69'
      },
      spill: [
        {
          polygon: [
            [0.303, 0.432],
            [0.447, 0.432],
            [0.431, 0.592],
            [0.252, 0.55]
          ],
          from: [0.45, 0.5],
          to: [0.266, 0.49],
          color: '#ffad76',
          opacity: 0.11
        },
        {
          polygon: [
            [0.486, 0.39],
            [0.645, 0.463],
            [0.683, 0.574],
            [0.484, 0.578]
          ],
          from: [0.467, 0.503],
          to: [0.65, 0.49],
          color: '#ffb77c',
          opacity: 0.1
        },
        {
          polygon: [
            [0.338, 0.539],
            [0.59, 0.525],
            [0.679, 0.719],
            [0.338, 0.77],
            [0.24, 0.663]
          ],
          from: [0.46, 0.527],
          to: [0.5, 0.76],
          color: '#ffac70',
          opacity: 0.1
        }
      ],
      embers: [
        {
          x: 0.456,
          y: 0.481,
          rx: 0.06,
          ry: 0.25,
          count: 20,
          color: '#ffd09a'
        }
      ]
    }
  },
  temple: {
    room: 6,
    name: 'The Temple',
    subtitle: 'A small part of something enormous.',
    treatment:
      'Deep indigo, pale porcelain, and a shared sky. Constellations slowly connect across the open floor while little beings wander beneath the arches.',
    zones: [
      {
        key: 'constellation-floor',
        cx: 0.503,
        cy: 0.534,
        rx: 0.352,
        ry: 0.242,
        capacity: 52,
        layout: 'scatter',
        motion: 'temple'
      },
      {
        key: 'left-moon-alcove',
        cx: 0.171,
        cy: 0.239,
        rx: 0.101,
        ry: 0.04,
        capacity: 12,
        layout: 'scatter',
        motion: 'temple'
      },
      {
        key: 'right-moon-alcove',
        cx: 0.829,
        cy: 0.241,
        rx: 0.1,
        ry: 0.04,
        capacity: 12,
        layout: 'scatter',
        motion: 'temple'
      },
      {
        key: 'lower-left-alcove',
        cx: 0.142,
        cy: 0.791,
        rx: 0.067,
        ry: 0.045,
        capacity: 12,
        layout: 'scatter',
        motion: 'temple'
      },
      {
        key: 'lower-right-alcove',
        cx: 0.866,
        cy: 0.8,
        rx: 0.067,
        ry: 0.045,
        capacity: 12,
        layout: 'scatter',
        motion: 'temple'
      }
    ],
    rims: [
      [
        [0.021, 0.611],
        [0.066, 0.652],
        [0.165, 0.636],
        [0.184, 0.66],
        [0.088, 0.687],
        [0.018, 0.652]
      ],
      [
        [0.836, 0.626],
        [0.91, 0.64],
        [0.968, 0.607],
        [0.98, 0.646],
        [0.91, 0.686],
        [0.83, 0.666]
      ],
      [
        [0.001, 0.872],
        [0.076, 0.911],
        [0.177, 0.886],
        [0.235, 0.839],
        [0.265, 0.852],
        [0.267, 0.94],
        [0.18, 1],
        [0, 1]
      ],
      [
        [0.76, 0.838],
        [0.796, 0.846],
        [0.91, 0.91],
        [0.98, 0.877],
        [1, 0.88],
        [1, 1],
        [0.843, 1],
        [0.76, 0.946]
      ]
    ],
    lights: [],
    vibe: {
      constellations: [
        {
          points: [
            [0.285, 0.477],
            [0.39, 0.369],
            [0.5, 0.337],
            [0.607, 0.369],
            [0.712, 0.477],
            [0.61, 0.589],
            [0.39, 0.589],
            [0.285, 0.477]
          ],
          color: '#f4dba4',
          polygon: [
            [0.17, 0.29],
            [0.84, 0.29],
            [0.84, 0.72],
            [0.17, 0.72]
          ]
        },
        {
          points: [
            [0.174, 0.597],
            [0.365, 0.623],
            [0.5, 0.749],
            [0.615, 0.624],
            [0.823, 0.597]
          ],
          color: '#bdd8f2',
          polygon: [
            [0.13, 0.55],
            [0.87, 0.55],
            [0.87, 0.78],
            [0.13, 0.78]
          ]
        },
        {
          points: [
            [0.091, 0.257],
            [0.17, 0.216],
            [0.251, 0.257],
            [0.17, 0.288]
          ],
          color: '#e8cf9b',
          polygon: [
            [0.06, 0.19],
            [0.29, 0.19],
            [0.29, 0.303],
            [0.06, 0.303]
          ]
        },
        {
          points: [
            [0.745, 0.255],
            [0.826, 0.216],
            [0.906, 0.259],
            [0.825, 0.29]
          ],
          color: '#e8cf9b',
          polygon: [
            [0.72, 0.19],
            [0.94, 0.19],
            [0.94, 0.305],
            [0.72, 0.305]
          ]
        },
        {
          points: [
            [0.378, 0.741],
            [0.5, 0.837],
            [0.629, 0.741]
          ],
          color: '#e8d1ac',
          polygon: [
            [0.31, 0.7],
            [0.7, 0.7],
            [0.7, 0.866],
            [0.31, 0.866]
          ]
        }
      ],
      light: [
        {
          polygon: [
            [0.415, 0.28],
            [0.59, 0.28],
            [0.765, 0.789],
            [0.276, 0.789]
          ],
          from: [0.5, 0.286],
          to: [0.5, 0.78],
          color: '#aec7ed',
          opacity: 0.05
        },
        {
          polygon: [
            [0.281, 0.017],
            [0.319, 0.017],
            [0.332, 0.28],
            [0.29, 0.279]
          ],
          from: [0.29, 0.045],
          to: [0.314, 0.28],
          color: '#dbdfed',
          opacity: 0.07
        },
        {
          polygon: [
            [0.678, 0.015],
            [0.711, 0.015],
            [0.697, 0.28],
            [0.667, 0.28]
          ],
          from: [0.69, 0.04],
          to: [0.678, 0.28],
          color: '#dbdfed',
          opacity: 0.07
        }
      ],
      stars: [
        {
          x: 0.45,
          y: 0.52,
          rx: 0.28,
          ry: 0.19,
          count: 12,
          color: '#eee4c8'
        },
        {
          x: 0.57,
          y: 0.72,
          rx: 0.21,
          ry: 0.14,
          count: 8,
          color: '#b7d1ed'
        }
      ]
    }
  },
  bathhouse: {
    room: 0,
    name: 'The Bathhouse',
    subtitle: 'A little soak. A little space.',
    treatment:
      'Silky mineral water and the hush of falling streams. Broad reflections drift across the pools; fine highlights travel down the falls, with a trace of mist where they meet the water.',
    zones: [
      {
        key: 'upper-pool',
        capacity: 24,
        layout: 'row',
        cx: 0.526,
        cy: 0.276,
        rx: 0.115,
        ry: 0.032,
        wet: true,
        motion: 'bath'
      },
      {
        key: 'left-pool',
        capacity: 20,
        layout: 'row',
        cx: 0.306,
        cy: 0.407,
        rx: 0.098,
        ry: 0.034,
        wet: true,
        motion: 'bath'
      },
      {
        key: 'middle-pool',
        capacity: 16,
        layout: 'row',
        cx: 0.491,
        cy: 0.508,
        rx: 0.096,
        ry: 0.027,
        wet: true,
        motion: 'bath'
      },
      {
        key: 'lower-pool',
        capacity: 28,
        layout: 'row',
        cx: 0.327,
        cy: 0.716,
        rx: 0.134,
        ry: 0.041,
        wet: true,
        motion: 'bath'
      },
      {
        key: 'pearl-pool',
        capacity: 12,
        layout: 'row',
        cx: 0.694,
        cy: 0.808,
        rx: 0.071,
        ry: 0.028,
        wet: true,
        motion: 'bath'
      }
    ],
    rims: [
      [
        [0.389, 0.309],
        [0.424, 0.329],
        [0.46, 0.33],
        [0.477, 0.354],
        [0.522, 0.35],
        [0.572, 0.321],
        [0.58, 0.342],
        [0.525, 0.378],
        [0.46, 0.378],
        [0.39, 0.344]
      ],
      [
        [0.197, 0.413],
        [0.227, 0.43],
        [0.268, 0.438],
        [0.285, 0.451],
        [0.323, 0.465],
        [0.376, 0.447],
        [0.4, 0.464],
        [0.36, 0.493],
        [0.291, 0.49],
        [0.22, 0.46],
        [0.19, 0.445]
      ],
      [
        [0.426, 0.542],
        [0.466, 0.552],
        [0.526, 0.542],
        [0.566, 0.53],
        [0.605, 0.548],
        [0.59, 0.571],
        [0.526, 0.577],
        [0.46, 0.588],
        [0.427, 0.571]
      ],
      [
        [0.151, 0.733],
        [0.187, 0.765],
        [0.241, 0.776],
        [0.302, 0.782],
        [0.358, 0.765],
        [0.405, 0.739],
        [0.458, 0.731],
        [0.457, 0.772],
        [0.383, 0.808],
        [0.31, 0.837],
        [0.208, 0.81],
        [0.15, 0.774]
      ],
      [
        [0.616, 0.83],
        [0.649, 0.859],
        [0.706, 0.861],
        [0.757, 0.834],
        [0.789, 0.819],
        [0.79, 0.85],
        [0.744, 0.877],
        [0.673, 0.895],
        [0.616, 0.872]
      ]
    ],
    lights: [],
    vibe: {
      water: [
        {
          polygon: [
            [0.380208, 0.260742],
            [0.465495, 0.232422],
            [0.548177, 0.22168],
            [0.613932, 0.232422],
            [0.667318, 0.248047],
            [0.621745, 0.272461],
            [0.563802, 0.290039],
            [0.550781, 0.305664],
            [0.486328, 0.319336],
            [0.465495, 0.306641],
            [0.420573, 0.292969],
            [0.39388, 0.277344]
          ],
          opacity: 0.18
        },
        {
          polygon: [
            [0.19987, 0.369141],
            [0.255208, 0.344727],
            [0.307943, 0.353516],
            [0.35026, 0.375977],
            [0.395182, 0.386719],
            [0.429036, 0.402344],
            [0.404948, 0.424805],
            [0.372396, 0.445313],
            [0.348307, 0.454102],
            [0.302734, 0.436523],
            [0.257161, 0.421875],
            [0.216797, 0.407227],
            [0.201172, 0.393555]
          ],
          opacity: 0.18
        },
        {
          polygon: [
            [0.412109, 0.442383],
            [0.452474, 0.428711],
            [0.503906, 0.44043],
            [0.54362, 0.464844],
            [0.544922, 0.485352],
            [0.575521, 0.498047],
            [0.597656, 0.513672],
            [0.585286, 0.52832],
            [0.545573, 0.541016],
            [0.492188, 0.549805],
            [0.443359, 0.545898],
            [0.416667, 0.52832],
            [0.410807, 0.481445]
          ],
          opacity: 0.18
        },
        {
          polygon: [
            [0.193359, 0.665039],
            [0.23112, 0.644531],
            [0.270182, 0.65625],
            [0.313802, 0.649414],
            [0.356771, 0.632813],
            [0.383464, 0.646484],
            [0.416667, 0.668945],
            [0.452474, 0.68457],
            [0.46224, 0.708008],
            [0.442057, 0.728516],
            [0.402995, 0.739258],
            [0.371745, 0.760742],
            [0.319661, 0.779297],
            [0.273438, 0.771484],
            [0.223958, 0.758789],
            [0.181641, 0.743164],
            [0.153646, 0.723633],
            [0.167969, 0.694336]
          ],
          opacity: 0.18
        },
        {
          polygon: [
            [0.604818, 0.773438],
            [0.644531, 0.754883],
            [0.688151, 0.760742],
            [0.733073, 0.776367],
            [0.765625, 0.797852],
            [0.770182, 0.819336],
            [0.746094, 0.837891],
            [0.705078, 0.850586],
            [0.660807, 0.848633],
            [0.627604, 0.832031],
            [0.600911, 0.806641]
          ],
          opacity: 0.18
        }
      ],
      falls: [
        {
          polygon: [
            [0.36849, 0.291992],
            [0.38151, 0.290039],
            [0.377604, 0.314453],
            [0.376302, 0.345703],
            [0.378906, 0.369141],
            [0.363932, 0.370117],
            [0.36263, 0.349609],
            [0.365885, 0.322266]
          ],
          opacity: 0.22
        },
        {
          polygon: [
            [0.455729, 0.333984],
            [0.46875, 0.333008],
            [0.464193, 0.359375],
            [0.464193, 0.387695],
            [0.469401, 0.423828],
            [0.447917, 0.424805],
            [0.44987, 0.394531],
            [0.451823, 0.361328]
          ],
          opacity: 0.22
        },
        {
          polygon: [
            [0.354167, 0.479492],
            [0.376302, 0.481445],
            [0.380859, 0.510742],
            [0.382161, 0.555664],
            [0.379557, 0.620117],
            [0.372396, 0.629883],
            [0.356771, 0.62207],
            [0.356771, 0.555664]
          ],
          opacity: 0.22
        },
        {
          polygon: [
            [0.428385, 0.566406],
            [0.448568, 0.5625],
            [0.444661, 0.592773],
            [0.442057, 0.628906],
            [0.448568, 0.660156],
            [0.421875, 0.662109],
            [0.423177, 0.620117]
          ],
          opacity: 0.22
        },
        {
          polygon: [
            [0.352214, 0.805664],
            [0.363932, 0.807617],
            [0.369792, 0.836914],
            [0.369792, 0.887695],
            [0.377604, 0.90332],
            [0.354167, 0.90332],
            [0.354167, 0.861328]
          ],
          opacity: 0.22
        },
        {
          polygon: [
            [0.639323, 0.875977],
            [0.654948, 0.870117],
            [0.655599, 0.899414],
            [0.653646, 0.932617],
            [0.658203, 0.963867],
            [0.633464, 0.967773],
            [0.635417, 0.930664]
          ],
          opacity: 0.22
        }
      ],
      mist: [
        {
          x: 0.458,
          y: 0.431,
          rx: 0.033,
          ry: 0.012,
          opacity: 0.07
        },
        {
          x: 0.405,
          y: 0.662,
          rx: 0.068,
          ry: 0.018,
          opacity: 0.065
        },
        {
          x: 0.65,
          y: 0.963,
          rx: 0.038,
          ry: 0.014,
          opacity: 0.06
        }
      ]
    }
  }
}
