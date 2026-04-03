// Dovetail Bolt Insert — Parametric Model
// All dimensions in mm
//
// Orientation:
//   Bottom (wide, "B") = z=0 — sits at the bottom of the dovetail slot
//   Top (narrow, "T")  = z=dv_height — at bench surface level
//   Bolt head pocket is recessed into the bottom face (z=0)
//   Bolt shaft points upward through the full height
//
// Standard 1/2" bench dog dovetail slot:
//   Bottom width: 12.7 mm (1/2"), Height: 9.525 mm (3/8"), Walls: 14° from vertical
//   Derived slot top opening: 12.7 - 2 * 9.525 * tan(14°) ≈ 7.95 mm

// --- Dovetail Insert Profile ---
dv_bottom_width = 12.6;  // Width at bottom (widest face); slightly less than 12.7 mm slot bottom
dv_height       = 9.0;   // Height of insert; slightly less than 9.525 mm slot depth
wall_angle      = 14;    // Wall angle in degrees from vertical

// --- Bolt Dimensions ---
head_width     = 8;    // Hex head flat-to-flat width (M5 default)
head_height    = 3.8;  // Hex head thickness
shaft_diameter = 5.1;  // Bolt shaft clearance diameter

// --- Insert Dimensions ---
insert_length = 40;

// --- Print Settings ---
layer_height = 0.2;  // Bridge step depth for support-free printing

// --- Fixed ---
chamfer = 0.5;

// Derived
dv_top_width = dv_bottom_width - 2 * dv_height * tan(wall_angle);
head_radius     = head_width / 2 / cos(30);

// Cross-section in XY plane.
// Bottom (wide) at Y=0, Top (narrow) at Y=dv_height.
// Chamfered corners (chamfer cuts corners at both top and bottom edges).
function dv_cross_section(tw, bw, h, ch) = [
    [-bw/2 + ch,  0      ],   // bottom-left  (chamfered along bottom)
    [-bw/2,       ch     ],   // bottom-left  (chamfered along wall)
    [-tw/2,       h - ch ],   // top-left     (chamfered along wall)
    [-tw/2 + ch,  h      ],   // top-left     (chamfered along top)
    [ tw/2 - ch,  h      ],   // top-right    (chamfered along top)
    [ tw/2,       h - ch ],   // top-right    (chamfered along wall)
    [ bw/2,       ch     ],   // bottom-right (chamfered along wall)
    [ bw/2 - ch,  0      ],   // bottom-right (chamfered along bottom)
];

module dv_body() {
    // Extrude cross-section along the insert length (Y axis).
    // rotate([90,0,0]) maps polygon Y → 3D Z, extrusion Z → 3D -Y,
    // then translate centres it on Y=0.
    translate([0, insert_length / 2, 0])
    rotate([90, 0, 0])
    linear_extrude(insert_length)
        polygon(dv_cross_section(dv_top_width, dv_bottom_width, dv_height, chamfer));
}

module hex_pocket() {
    // Hex bolt head recess cut into the bottom face (z=0)
    translate([0, 0, -0.01])
        cylinder(h = head_height + 0.01, r = head_radius, $fn = 6);
}

module shaft_hole() {
    // Clearance hole for bolt shaft through the full height
    translate([0, 0, -0.01])
        cylinder(h = dv_height + 0.02, d = shaft_diameter, $fn = 32);
}

module bridge_step() {
    // Thin rectangular slot at the ceiling of the hex pocket (z = head_height).
    // Width matches the shaft hole so the printer can bridge without supports.
    translate([-shaft_diameter/2, -head_width/2, head_height])
        cube([shaft_diameter, head_width, layer_height]);
}

module bridge_step_square() {
    // Square slot one layer above the first bridge step.
    translate([-shaft_diameter/2, -shaft_diameter/2, head_height + layer_height])
        cube([shaft_diameter, shaft_diameter, layer_height]);
}

difference() {
    dv_body();
    hex_pocket();
    shaft_hole();
    bridge_step();
    bridge_step_square();
}
