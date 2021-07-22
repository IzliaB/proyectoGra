// import * as React from 'react';
import React, { useState } from 'react';
import { Component } from 'react';
import {
  ScrollView,
  Text,
  View,
  PermissionsAndroid,
  Platform,
  Image,
  Animated,
  Dimensions,
  TouchableOpacity,
  // SafeAreaView,
  // Modal,
  Picker,
} from 'react-native'
import { Dropdown } from 'react-native-material-dropdown';
import { connect } from 'react-redux'
// Add Actions - replace 'Your' with whatever your reducer is called :)
// import YourActions from '../Redux/YourRedux'

import AppointmentOptionCard, { AppoinmentOptionCardProps } from "../Components/AppoinmentOptionCard";

import { Appbar, ActivityIndicator, Title, Badge, Portal } from "react-native-paper";
import { Icon as ElementIcon, SearchBar, } from 'react-native-elements'

import { Icon } from "../Components/JamIcons";

import _ from "lodash";


// Styles
import styles from './Styles/SelectMedicalAttentionCenterScreenStyle'

import Colors from "../Themes/Colors"

import { fetchAffiliates } from "../Redux/SearchAffiliate/SearchAffiliateActions";
import { getAvailableDate } from '../Lib/utils';

import nextFrame from "next-frame";

import RNAndroidLocationEnabler from 'react-native-android-location-enabler';
import { interval } from 'rxjs';
import GPSState from 'react-native-gps-state';
import Geolocation from 'react-native-geolocation-service';
import { LogAddPaquete } from '../Lib/EventsManager'
import { catch } from '../../../metro.config';
import BottomSheetCustom from '../Components/Common/BottomSheetCustom';
import moment from 'moment';
import SearchModal from '../Components/SearchModalDoctors';
// import ModalPicker from '../Components/Modal'

/* const appointmentOptions: Array<AppoinmentOptionCardProps & any> = [
  {
    title: "Alvaro Flores",
    subtitle: "Medicina General - 6 años de experiencia",
    attentionCenter: "Clinica Medica los Andes",
    distanceInKMS: 350,
    availableDate: new Date(),
    currencySymbol: "Lps.",
    photoUrl: null,
    averageRanking: 0.94,
    minPrice: 750,
    price: null
  },
  {
    title: "Andres Sosa",
    subtitle: "Medicina General - 6 años de experiencia",
    attentionCenter: "Clinica Medica del Valle",
    distanceInKMS: 100,
    availableDate: new Date(),
    currencySymbol: "Lps.",
    photoUrl: null,
    averageRanking: 0.98,
    price: 600,
  }
] */

const defaultCoords = {
  latitude: 15.5058615,
  longitude: -88.0274529
};

type SelectMedicalAttentionCenterScreenProps = {
  navigation: any,
  fetchAffiliates: Function,
  affiliates: Array<any>
}

let _this = null;
class SelectMedicalAttentionCenterScreen extends Component<SelectMedicalAttentionCenterScreenProps, any> {

  sheetRef: any;
  window = Dimensions.get('window');
  genders = [ ({ value: 'Masculino', id: 'M',}), ({value: 'Femenino', id: 'F'}) ];
  availabilities = [({value: 'Disponibles', id: 1,}), ({value: 'No disponibles', id: 2})];
  specialties = [];
  prices = [];
  constructor(props: Readonly<SelectMedicalAttentionCenterScreenProps>) {
    super(props);
    this.state = {
      loading: true,
      location_state: true,
      opacity: new Animated.Value(0),
      isOpen: false,
      showSearchModal: false,
      availability: '',
      gender: '',
      specialty: '',
      price: '',
    };
    this.sheetRef = React.createRef();
  }
  static navigationOptions = ({ navigation }) => ({
    header: (
      <Appbar.Header style={{ elevation: 0 }} dark={true} theme={{
        colors: {
          primary: Colors.background,
        }
      }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Seleccionar Médico o Clinica" />
        <View>
          <Badge
            visible={navigation.state.params.filterActive}
            size={8}
            style={{ position: 'absolute', top: 10, right: 11 }}
          >
            {/* {notificationsCount} */}
          </Badge>
          <Appbar.Action icon={(iconProps) => (
            <Icon {...iconProps} name="filter-f" color={"#efefef"} />
          )} onPress={() => { _this.onOpen() }} />
        </View>
        <View>
          <Appbar.Action icon={(iconProps) => (
            <Icon {...iconProps} name="search" color={"#efefef"} />
          )} onPress={() => { _this.onOpenSearchbar() }} />
        </View>
      </Appbar.Header>
    ),
  });

  async getLocation() {
    const { params = {} } = await this.props.navigation.state;
    await nextFrame();
    return new Promise(async (_resolve, _reject) => {
      const granted = await this.requestLocationPermission();
      console.log(`Granted`, granted);
      if (granted) {

        if (Platform.OS == "android") {
          await RNAndroidLocationEnabler.promptForEnableLocationIfNeeded({ interval: 10000, fastInterval: 5000 })
            .then((data: any) => {

              switch (data) {
                case 'already-enabled':
                case 'enabled':
                  requestAnimationFrame(() => {
                    Geolocation.getCurrentPosition(_resolve, _reject, { enableHighAccuracy: true, maximumAge: 10000 });
                    // navigator.geolocation.getCurrentPosition(_resolve, _reject, {enableHighAccuracy:true, timeout:60000});
                  });
                  break;
              }

            }).catch(err => {
              if (err && err.code) {
                if (err.code === 'ERR00') {
                  this.setState({ loading: false, location_state: false });
                  if (this.props.affiliates.length === 0) {
                    console.log(`Este es error del RNAndroidLocationEnabler`);
                    alert("No se pudo obtener la ubicación. Habilite el GPS del dispositivo.");
                  }
                }
              }
            });
        } else {

          requestAnimationFrame(() => {
            Geolocation.getCurrentPosition(_resolve, _reject, { enableHighAccuracy: true, maximumAge: 10000 });
            // navigator.geolocation.getCurrentPosition(_resolve, _reject, {enableHighAccuracy:true, timeout:60000});
          });
        }

      } else {
        _reject(new Error("LOCATION_PERMISSION_NOT_GRANTED"));
      }
    }).catch((error) => {
      console.log(error);
      console.log(`Este no es error del RNAndroidLocationEnabler`);
      alert("No se pudo obtener la ubicación. Habilite el GPS del dispositivo.");
    });
  }

  async requestLocationPermission() {
    try {
      if (Platform.OS == "android") {
        await nextFrame();
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            'title': 'Permisos de Ubicación',
            'message': 'Dokto necesita acceder a su ubicación para encontrar doctores o centros de atención cercanos.'
          }
        )
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log(`Permisos Granted`);
          return true;
        } else {
          console.log(`Permisos Non-Granted`);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.log(`Permisos Granted`);
      console.warn(err)
    }

    return false;
  }

  transformData(data: any) {
    const { params = {} } = this.props.navigation.state;
    const services = _.orderBy(data.services || [], (s) => {
      return s.place && s.place.dist && s.place.calculated;
    });
    const cheaper = _.minBy(services, (s: any) => s.price);
    const near = services[0];
    const cardProps: AppoinmentOptionCardProps & any = {
      _id: data._id,
      title: data.fullName || data.name,
      subtitle: [data.specialty, `${data.yearsExperience || 1} años de exp.`].join(" - "),
      attentionCenter: near && near.place && near.place.name,
      virtualServicesOnly: params.virtualServicesOnly,
      distanceInKMS: near && near.place && near.place.dist && Math.ceil(near.place.dist.calculated / 1000),
      availableDate: data.availability && getAvailableDate(data.availability.attentionSchedules || []),
      availability: data.availability,
      currencySymbol: data.currency,
      photoUrl: data.image,
      averageRating: data.feedbackCount ? data.rating : undefined,
      minPrice: cheaper && cheaper.price,
      price: services.length > 1 ? null : services[0] && services[0].price,
      affiliateType: data.affiliateType
    }

    return cardProps;
  }

  formatString(myString: any) {
    try {
      return myString.toLowerCase().replace(/\s/g, "_").replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (ex) {
      return null;
    }
  }

  componentDidMount() {
    _this = this;
    const { params = {} } = this.props.navigation.state;
    this.props.navigation.setParams({
      filterActive: false,
    });
    console.log(`Data`, params);
    try {
      LogAddPaquete(this.formatString(params.name));
    } catch (ex) { }
    if (Platform.OS === 'android') {
      setTimeout(() => {
        this.EnableListeners();
        this.LoadAffiliates();
      }, 2000);
    } else {
      this.LoadWithoutLocation();
    }
    this.LoadAffiliates();
    this.EnableListeners();
  }

  componentWillUnmount() {
    try { GPSState.removeListener() } catch (error) { };
  }

  LoadAffiliates() {
    const { params = {} } = this.props.navigation.state;
    this.getLocation().then((result: any) => {
      console.log(result);
      if (result && result.coords) {
        this.setState(({
          lastLocation: result.coords,
        }), () => {
          this.props.fetchAffiliates(result.coords, params.categories || [], params.virtualServicesOnly).then(() => {
            this.getFilterData();
            this.setState({
              loading: false,
            });
          });
        });
      }
    })
  }

  getFilterData() {
    //Availabilities
    // this.availabilities.push({
    //   value: 'Disponibles',
    //   id: 1,
    // });
    // this.availabilities.push({
    //   value: 'No disponibles',
    //   id: 2,
    // });

    // //Genders
    // this.genders.push({
    //   value: 'Masculino',
    //   id: 'M',
    // });
    // this.genders.push({
    //    value: 'Femenino',
    //    id: 'F',
    //  });

    //Specialties

    const specialties = this.props.affiliates.map(item => item.specialty)
      .filter((value, index, self) => self.indexOf(value) === index).map(item => { return { value: item } })
    specialties.sort((a, b) => (a.value < b.value) ? -1 : ((a.value > b.value) ? 1 : 0));
    this.specialties = specialties;
    console.log('specialties :>> ', specialties);

    //Prices
    // const prices = affiliates.map(item => item.minPrice)
    //   .filter((value, index, self) => self.indexOf(value) === index).map(item => { return {value: item } });
    // prices.sort((a, b) => a.value - b.value);
    // this.prices = prices;
    // console.log('prices :>> ', prices);

    this.prices.push({
      value: '0 - 500',
      minValue: 0,
      maxValue: 500,
      id: 1,
    });
    this.prices.push({
      value: '501 - 1000',
      minValue: 501,
      maxValue: 1000,
      id: 2,
    });
    this.prices.push({
      value: '1001 - 1500',
      minValue: 1001,
      maxValue: 1500,
      id: 3,
    });
    this.prices.push({
      value: '1501 - 2000',
      minValue: 1501,
      maxValue: 2000,
      id: 4,
    });
    this.prices.push({
      value: '2001 - 2500',
      minValue: 2001,
      maxValue: 2500,
      id: 5,
    });
    this.prices.push({
      value: '+2501',
      minValue: 2501,
      maxValue: 9999999,
      id: 6,
    });

  }



  LoadWithoutLocation() {
    const { params = {} } = this.props.navigation.state;
    if (defaultCoords) {
      this.setState(({
        lastLocation: defaultCoords,
      }), () => {
        this.props.fetchAffiliates(defaultCoords, params.categories || [], params.virtualServicesOnly).then(() => {
          this.setState({
            loading: false,
          });
        });
      });
    }
  }


  EnableListeners() {
    if (Platform.OS == "android") {
      GPSState.addListener((status) => {
        switch (status) {
          case GPSState.NOT_DETERMINED:
            console.log('1');
            break;

          case GPSState.RESTRICTED:
            console.log('2');
            break;

          case GPSState.DENIED:
            console.log('3');
            break;

          case GPSState.AUTHORIZED_ALWAYS:
            if (!this.state.location_state) {
              this.setState({ loading: true, location_state: true });
              this.LoadAffiliates();
            }
            break;

          case GPSState.AUTHORIZED_WHENINUSE:
            console.log('5');
            break;
        }
      })
      GPSState.requestAuthorization(GPSState.AUTHORIZED_WHENINUSE)
    }
  }

  onPressScheduleAppoinment(affiliate: { services: any; _id: any; }) {
    const services = _.orderBy(affiliate.services || [], (s: any) => {
      return s.place && s.place.dist && s.place.calculated;
    });

    const categoryResult = _.uniq(_.flatMap(services, (s) => s.categoryResult || []));

    const selectedService = _.find(services, (s) => {
      if (categoryResult.length != 1) return false;
      return s.categoryResult && _.some(s.categoryResult, (c: any) => {
        return categoryResult.includes(c);
      });
    });

    this.props.navigation.navigate("ScheduleMedicalAppointmentScreen", {
      affiliate: affiliate._id,
      interestCategories: categoryResult,
      selectedService: selectedService && selectedService._id,
      selectedPlace: selectedService && selectedService.place && selectedService.place._id,
    });
  }

  renderAffiliates = () => {
    if (this.state.loading) return null;
    var affiliates = this.getFilteredData(this.props.affiliates);
    return (
      <ScrollView style={styles.container}>

        {this.renderSearchModal()}
        <View style={{ marginHorizontal: 15, marginTop: 20, flexWrap: "wrap" }}>
          {affiliates.map((affiliate, index) => {
            const cardProps = this.transformData(affiliate);
            return (
              <View key={index} style={{ flex: 1, flexWrap: "wrap" }}>
                <AppointmentOptionCard {...cardProps} key={index} onPressShowProfile={() => this.showProfile(affiliate)} onPressScheduleAppoinment={() => this.onPressScheduleAppoinment(affiliate)} />
              </View>
            )
          })}
        </View>
        {this.state.isOpen && this.renderBackDrop()}
        <BottomSheetCustom
          ref={this.sheetRef}
          hideShadow={true}
          onCloseEnd={this.onClose}
          snapPoints={[
            -10,
            this.window.height * 0.5,
          ]}
          show={this.state.isOpen}
          renderContent={() => this.renderFiltersContent()}
          renderHeader={() => this.renderFilterHeader()}
          initialSnap={0}
        />
      </ScrollView>
    );
  }

  getFilteredData = (affiliates: any[]): any[] => {
    affiliates.sort((a, b) => {
      var aTransformed = this.transformData(a);
      var bTransformed = this.transformData(b);

      return aTransformed.availableDate - bTransformed.availableDate;
    })

    var affiliateFiltered = [...affiliates];

    if (this.state.availability !== "") {
      var today = false;
      switch (this.state.availability) {
        case 1:
          today = true;
          break;
        case 2:
          today = false;
          break;
        default:
          break;
      }
      affiliateFiltered = affiliateFiltered.filter(affiliate => {
        var transformed = this.transformData(affiliate);
        const availableToday = transformed.availableDate && moment(transformed.availableDate).startOf("day").format() == moment().startOf("day").format() && transformed.availableDate <= moment().toDate();
        return availableToday == today;
      });
    }

    if (this.state.gender !== "") {
      affiliateFiltered = affiliateFiltered.filter(affiliate => affiliate.gender === this.state.gender);
    }

    if (this.state.specialty !== "") {
      affiliateFiltered = affiliateFiltered.filter(affiliate => affiliate.specialty === this.state.specialty);
    }

    if (this.state.price !== "") {
      var selected = this.prices.find(item => item.id === this.state.price);

      affiliateFiltered = affiliateFiltered.filter(affiliate => {
        var transformed = this.transformData(affiliate);
        var isWithinPriceRange: boolean = ((selected.minValue <= transformed.minPrice) && (selected.maxValue >= transformed.minPrice))
        return isWithinPriceRange;
      });
    }


    console.log('price :>> ', this.state.price);
    return affiliateFiltered;
  }


  renderEmptyIllustration = () => (
    <View style={{ height: '100%', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <Image style={{ height: 181, width: 219 }} source={require('./../Images/noAffiliateEmptyIllustration.png')} />
      <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#858585', marginTop: 40, marginBottom: 20 }}>¡Oops!</Text>
      <Text style={{ width: '70%', textAlign: 'center', color: '#858585', fontSize: 14 }}>Parece que aun no tenemos Doctores
        que concuerden con tu busqueda.</Text>
    </View>
  )

  renderBackDrop = () => (
    <Animated.View
      style={{
        opacity: this.state.opacity,
        backgroundColor: '#000',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}>
      <TouchableOpacity
        style={{
          width: this.window.width,
          height: this.window.height,
          backgroundColor: 'transparent',
        }}
        activeOpacity={1}
        onPress={this.onClose}
      />
    </Animated.View>
  );

  renderFilterHeader = () => {
    return (
      <View style={{ backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingTop: 10 }}>
        <ElementIcon style={{ justifyContent: 'center', alignItems: 'center', }} name='drag-handle' type='material' />
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingStart: 20, paddingEnd: 20, }}>
          <Title style={{ fontWeight: 'bold', justifyContent: 'flex-start', alignItems: 'flex-start', color: Colors.background }}>Filtros</Title>
          <ElementIcon style={{ justifyContent: 'center', alignItems: 'center', margin: 'auto' }} color='#f50' name='x-octagon' type='feather' onPress={this.clearFilters} />
        </View>
      </View>
    )
  }
  renderFiltersContent = () => {

    return (
      <View style={{ backgroundColor: 'white', height: '100%', paddingStart: 20, paddingEnd: 20 }}>
        <View style={{ paddingTop: 5 }}>
          {/* <Text style={{ fontSize: 12 }}>
            Género
          </Text> */}
          <Picker
            selectedValue={this.state.availability}
            style={{ width: '100%'}}
            onValueChange={(itemValue, itemIndex) =>
              this.setState({ availability: itemValue })}>
                 <Picker.Item label="Disponibilidad" value={0} /> 
            {this.availabilities.map((availabilities, i) => {
              return <Picker.Item label={availabilities.value} key={i} value={availabilities.id} />
            })}
          </Picker>
        </View>
         <View style={{ paddingTop: 5 }}>
          {/* <Text style={{ fontSize: 12 }}>
            Género
          </Text> */}
          <Picker
            selectedValue={this.state.gender}
            style={{ width: '100%'}}
            onValueChange={(itemValue, itemIndex) =>
              this.setState({ gender: itemValue })}>
                <Picker.Item label="Género" value={0} />
            {this.genders.map((genders, i) => {
              return <Picker.Item label={genders.value} key={i} value={genders.id} />
            })}
          </Picker>
        </View>
        <View style={{ paddingTop: 5 }}>
          <Dropdown
            labelFontSize={16}
            style={{ width: '100%' }}
            label='Especialidad'
            value={this.state.specialty}
            onChangeText={(value: any) => {
              this.onSelect("specialty", value);
            }}
            data={this.specialties}
          />
        </View>
        <View style={{ paddingTop: 5 }}>
          <Dropdown
            labelFontSize={16}
            style={{ width: '100%' }}
            label='Precio'
            value={this.state.price}
            labelExtractor={(item: { value: any; }) => item.value}
            valueExtractor={(item: { id: any; }) => item.id}
            onChangeText={(value: any) => {
              this.onSelect("price", value);
            }}
            data={this.prices}
          />
        </View>

        <View style={{ paddingTop: 5 }}>
          {/* <Text style={{ fontSize: 12 }}>
            Género
          </Text> */}
          <Picker
            selectedValue={this.state.specialty}
            style={{ width: '100%'}}
            onValueChange={(itemValue, itemIndex) =>
              this.setState({ specialty: itemValue })}>
            {this.specialties.map((specialties, i) => {
              return <Picker.Item label={specialties.value} key={i} value={specialties.id} />
            })}
          </Picker>
        </View>
      </View>
    )
  }

  onSelect(key: string, value: any) {
    this.props.navigation.setParams({ filterActive: true });
    this.setState({ [key]: value, });
  }

  clearFilters = () => {
    this.props.navigation.setParams({ filterActive: false });
    this.setState({
      availability: '',
      specialty: '',
      price: '',
      gender: '',
    })
  }

  onClose = () => {
    Animated.timing(this.state.opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
    this.sheetRef.current.snapTo(0);
    setTimeout(() => {
      this.setState({ isOpen: false });
    }, 50);
  };

  onOpen = () => {
    this.setState({ isOpen: true });
    this.sheetRef.current.snapTo(1);
    Animated.timing(this.state.opacity, {
      toValue: 0.7,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  onOpenSearchbar = () => {
    this.setState({ showSearchModal: true });
    console.log('showSearchModal :>> ', this.state.showSearchModal);
  };

  renderSearchbar() {
    return (
      <View style={{ zIndex: 1600, backgroundColor: "white", marginTop: 8, width: "100%", flexWrap: "wrap" }}>
        <SearchBar></SearchBar>
      </View>
    )
  }

  showProfile(affiliate: any) {
    this.props.navigation.navigate("AffiliateProfileScreen", { id: affiliate._id });
  }

  renderSearchModal() {
    return (
      <Portal>
        <SearchModal visible={this.state.showSearchModal} navigation={this.props.navigation} onClose={() => {
          this.setState({ showSearchModal: false })
        }}></SearchModal>
      </Portal>
    );
  }

  render() {
    if (this.state.loading) {
      return (
        <React.Fragment>
          <View style={{ marginTop: 30, padding: 5, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color="gray"></ActivityIndicator>
          </View>
        </React.Fragment>
      )
    }

    if (!this.state.loading && !this.props.affiliates.length) {
      return this.renderEmptyIllustration();
    }

    return this.renderAffiliates();
  }
}

const mapStateToProps = (state: { searchAffiliate: { result: any; }; }) => {
  return {
    affiliates: state.searchAffiliate.result
  }
}

const mapDispatchToProps = (dispatch: (arg0: (dispatch: any) => Promise<any[]>) => any) => {
  return {
    fetchAffiliates: (coords: any, categories: any, virtualServicesOnly: boolean) => dispatch(fetchAffiliates(coords, categories, virtualServicesOnly))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectMedicalAttentionCenterScreen)


