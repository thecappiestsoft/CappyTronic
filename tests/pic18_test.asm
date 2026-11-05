        LIST p=18F4550
        #include <p18f4550.inc>
        CONFIG FOSC = HS, WDT = OFF, LVP = OFF, PBADEN = OFF, MCLRE = ON, PWRT = OFF
        CBLOCK 0x20
        cnt1, adch, tmp
        ENDC
        ORG 0x0000
        goto main
        ORG 0x0008
        retfie FAST
        ORG 0x0018              ; przerwanie niskiego priorytetu: Timer1
lowisr  bcf PIR1, TMR1IF
        incf cnt1, F
        retfie
main    movlw 0x0E              ; AN0 analogowe, reszta cyfrowe
        movwf ADCON1
        clrf TRISD
        clrf LATD
        ; ADC: kanał 0, wyrównanie do lewej, Tacq 4 TAD, Fosc/32
        movlw b'00010010'
        movwf ADCON2
        movlw b'00000001'
        movwf ADCON0
        bsf ADCON0, GO
adw     btfsc ADCON0, GO
        bra adw
        movff ADRESH, adch
        movff ADRESH, LATD
        ; PWM CCP1 (RC2): PR2 = 249, preskaler 1 → 20 kHz, wypełnienie 25 %
        movlw d'249'
        movwf PR2
        movlw d'62'             ; 250 * 0,25 = 62,5 → CCPR1L:DC1B = 250 (10 bit)
        movwf CCPR1L
        movlw b'00101100'       ; DC1B = 10, tryb PWM
        movwf CCP1CON
        bcf TRISC, 2
        movlw b'00000100'
        movwf T2CON
        ; Timer1 z przerwaniem o niskim priorytecie
        bsf RCON, IPEN
        bcf IPR1, TMR1IP
        bsf PIE1, TMR1IE
        movlw b'00000001'       ; Timer1 wł., preskaler 1:1 → przepełnienie co 13,1 ms
        movwf T1CON
        bsf INTCON, GIEL
        bsf INTCON, GIEH
        ; I2C master 100 kHz → PCF8574 (0x20) = 0x55
        movlw d'49'
        movwf SSPADD
        movlw b'00101000'
        movwf SSPCON1
        bsf SSPCON2, SEN
w1      btfsc SSPCON2, SEN
        bra w1
        movlw 0x40
        call i2cw
        movlw 0x55
        call i2cw
        bsf SSPCON2, PEN
w2      btfsc SSPCON2, PEN
        bra w2
        ; mnożenie i adresowanie pośrednie
        movlw d'13'
        mullw d'17'             ; 221
        movff PRODL, tmp
        lfsr 0, 0x100
        movlw 7
        movwf POSTINC0
        movwf POSTINC0
        movf FSR0L, W           ; 2
        addwf tmp, F            ; 223
loop    bra loop
i2cw    bcf PIR1, SSPIF
        movwf SSPBUF
w3      btfss PIR1, SSPIF
        bra w3
        return
        END
