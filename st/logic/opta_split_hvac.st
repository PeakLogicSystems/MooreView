(*

  Opta Split HVAC — single air handler + outdoor condenser

  MooreVIEW Parc driver (Opta firmware v2.3.81+):
    /mcsa  Split condenser — I1/I3 start CT, I2/I4 run CT (fan + comp)
    /ahu-env — AHU1 supply/return NTC (I5–I6), pan leak (D1608E X1_IRAW1), blower CT via split AHU preset

  Parc input tags (sync from device):
    COMP_FLT, FAN_FLT, T1_C, T2_C, COMP_AMPS, COMP_START_AMPS, FAN_AMPS, FAN_START_AMPS
    AHU1_SUPPLY_TEMP_F, AHU1_RETURN_TEMP_F, AHU1_PAN_LEAK, AHU1_BLOWER_FLT, AHU1_BLOWER_AMPS, AHU1_BLOWER_START_AMPS

  HMI: screen_1 3D · screen_2 overview · screen_3 AHU · screen_4 condenser
  3D:  /samples/opta-split-hvac-ortho-3d.html

*)

IF COMP_FLT OR FAN_FLT THEN TurnON(COND_ALM); ELSE TurnOFF(COND_ALM); END_IF;
IF AHU1_PAN_LEAK OR AHU1_BLOWER_FLT THEN TurnON(AHU_ALM); ELSE TurnOFF(AHU_ALM); END_IF;
IF COND_ALM OR AHU_ALM THEN TurnON(SYS_ALM); ELSE TurnOFF(SYS_ALM); END_IF;
