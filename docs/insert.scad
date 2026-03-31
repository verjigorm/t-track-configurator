// T-Track Bolt Insert — Parametric Model
// All dimensions in mm
//
// Orientation:
//   Lip (wide)    = BOTTOM — sits inside the T-track channel
//   Slot (narrow) = TOP    — protrudes through the slot opening
//   Bolt head pocket is recessed into the bottom of the lip section
//   Bolt shaft points upward through the full height

// --- T-Track Profile ---
slot_width = 19;   // Width of the narrow slot section (bottom)
lip_width  = 23;   // Width of the wide lip section (top)
slot_depth = 6;    // Height of the slot section
lip_depth  = 3.5;    // Height of the lip section

// --- Bolt Dimensions ---
head_width     = 13;  // Hex head flat-to-flat width
head_height    = 6;   // Hex head thickness
shaft_diameter = 8.2;   // Bolt shaft clearance diameter

// --- Insert Dimensions ---
insert_length = 25;

// --- Fixed ---
chamfer = 0.2;

// Derived
total_depth = slot_depth + lip_depth;
head_radius = head_width / 2 / cos(30);

// T cross-section in the XY plane (X = width, Y = height).
// Lip (wide) at bottom (Y=0), Slot (narrow) at top (Y=total_depth).
// Chamfered corners (long-edge corners only):
//   - bottom-left and bottom-right of lip
//   - step corners at top of lip (outer only; inner junction stays sharp)
//   - top-left and top-right of slot
function t_cross_section(sw, lw, sd, ld, ch) = [
    [-lw/2 + ch,  0       ],  // bottom-left of lip   (chamfered)
    [-lw/2,       ch      ],
    [-lw/2,       ld - ch ],
    [-lw/2 + ch,  ld      ],  // step left top        (chamfered)
    [-sw/2,       ld      ],  // junction left        (sharp)
    [-sw/2,       ld+sd-ch],
    [-sw/2 + ch,  ld+sd   ],  // top-left of slot     (chamfered)
    [ sw/2 - ch,  ld+sd   ],  // top-right of slot    (chamfered)
    [ sw/2,       ld+sd-ch],
    [ sw/2,       ld      ],  // junction right       (sharp)
    [ lw/2 - ch,  ld      ],  // step right top       (chamfered)
    [ lw/2,       ld - ch ],
    [ lw/2,       ch      ],
    [ lw/2 - ch,  0       ],  // bottom-right of lip  (chamfered)
];

module t_body() {
    // Extrude the cross-section along Y (insert length direction).
    // rotate([90,0,0]) maps polygon Y → 3D Z, extrusion Z → 3D -Y,
    // then translate centres it on Y=0.
    translate([0, insert_length / 2, 0])
    rotate([90, 0, 0])
    linear_extrude(insert_length)
        polygon(t_cross_section(slot_width, lip_width, slot_depth, lip_depth, chamfer));
}

module hex_pocket() {
    // Hex bolt head recess cut into the bottom of the slot section (Z=0 face)
    translate([0, 0, -0.01])
        cylinder(h = head_height + 0.01, r = head_radius, $fn = 6);
}

module shaft_hole() {
    // Clearance hole for bolt shaft through the full height
    translate([0, 0, -0.01])
        cylinder(h = total_depth + 0.02, d = shaft_diameter, $fn = 32);
}

difference() {
    t_body();
    hex_pocket();
    shaft_hole();
}
