        LIST p=16F84A
        #include <p16f84a.inc>
        __CONFIG _HS_OSC & _WDT_OFF & _PWRTE_OFF
ticks   EQU 0x0C
rbch    EQU 0x0D
eerd    EQU 0x0E
tab     EQU 0x0F
sum     EQU 0x10
arr     EQU 0x20
w_tmp   EQU 0x30
s_tmp   EQU 0x31
        ORG 0
        goto main
        ORG 4
isr     movwf w_tmp
        swapf STATUS, w
        movwf s_tmp
        btfss INTCON, T0IF
        goto  rb
        bcf   INTCON, T0IF
        incf  ticks, f          ; 4 MHz, preskaler 1:16 -> 4,096 ms
rb      btfss INTCON, RBIF
        goto  out
        movf  PORTB, w          ; koniec niedopasowania
        bcf   INTCON, RBIF
        incf  rbch, f
out     swapf s_tmp, w
        movwf STATUS
        swapf w_tmp, f
        swapf w_tmp, w
        retfie
main    clrf ticks
        clrf rbch
        bsf  STATUS, RP0
        movlw b'00000011'       ; TMR0: zegar wewn., preskaler 1:16, podciąganie PORTB
        movwf OPTION_REG
        bcf  STATUS, RP0
        movlw b'10101000'       ; GIE, T0IE, RBIE
        movwf INTCON
        ; EEPROM: zapis 0x5A pod adres 5
        movlw 5
        movwf EEADR
        movlw 0x5A
        movwf EEDATA
        bsf  STATUS, RP0
        bsf  EECON1, WREN
        bcf  INTCON, GIE
        movlw 0x55
        movwf EECON2
        movlw 0xAA
        movwf EECON2
        bsf  EECON1, WR
        bsf  INTCON, GIE
wait    btfsc EECON1, WR
        goto wait
        bcf  EECON1, WREN
        bsf  EECON1, RD
        bcf  STATUS, RP0
        movf EEDATA, w
        movwf eerd
        ; tablica
        movlw 2
        call  table
        movwf tab
        ; FSR: arr[i]=i, suma 0..8 = 36
        movlw arr
        movwf FSR
        clrf  sum
        movlw 9
        movwf w_tmp+2
        clrf  w_tmp+3
fill    movf  w_tmp+3, w
        movwf INDF
        addwf sum, f
        incf  FSR, f
        incf  w_tmp+3, f
        decfsz w_tmp+2, f
        goto fill
loop    goto loop
table   addwf PCL, f
        DT 0x11, 0x22, 0x37, 0x44
        END
