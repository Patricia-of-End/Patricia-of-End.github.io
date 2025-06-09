// js/eq-presets.js

// exportすることで、他のファイルからこのデータをインポートして使えるようにします。
export const PRESETS = [
    {
        name: "Flat",
        gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
        name: "Perfect", 
        gains: [6, 5, 4, 2, 1, 1, 3, 4, 5, 6]
    },
    {
        name: "Rock",
        gains: [5, 4, 2, -2, -3, 0, 3, 4, 5, 6]
    },
    {
        name: "Pop",
        gains: [-1, 0, 1, 3, 4, 3, 1, 0, -1, -2]
    },
    {
        name: "Jazz",
        gains: [4, 2, 1, 2, -1, -1, 0, 1, 2, 3]
    },
    {
        name: "Classical",
        gains: [5, 4, 3, 2, -1, -1, -1, 0, 2, 4]
    },
    {
        name: "Vocal Boost",
        gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2]
    }
];