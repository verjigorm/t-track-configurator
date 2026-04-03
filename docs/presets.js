export const TRACK_PRESETS = {
    'wide-metric':   { slot_width: 19, lip_width: 23, slot_depth: 6,  lip_depth: 3.5 },
    'narrow-metric': { slot_width: 9.0, lip_width: 13.9, slot_depth: 2, lip_depth: 3.0 },
};

export const BOLT_PRESETS = {
    'm4': { head_width: 7,    head_height: 2.9, shaft_diameter: 4.1 },
    'm5': { head_width: 8,    head_height: 3.8, shaft_diameter: 5.1 },
    'm6': { head_width: 10,   head_height: 4,   shaft_diameter: 6.5 },
    'm8': { head_width: 13,   head_height: 6,   shaft_diameter: 8.2 },
    'm10':{ head_width: 17,   head_height: 7,   shaft_diameter: 10.5 },
};

// Default values applied when switching to dovetail mode (all in mm; wall_angle in degrees)
export const DOVETAIL_DEFAULTS = {
    dv_bottom_width: 12.6,
    dv_height:       9.0,
    wall_angle:      14,
    insert_length:   40,
    chamfer:         0.5,
    head_width:      8,
    head_height:     3.8,
    shaft_diameter:  5.1,
};

export const TRACK_PARAM_KEYS = ['slot_width', 'lip_width', 'slot_depth', 'lip_depth'];
export const BOLT_PARAM_KEYS  = ['head_width', 'head_height', 'shaft_diameter'];
